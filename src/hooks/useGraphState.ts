import { useState, useRef } from 'react';
import { GraphManager, Node as GraphNode, Link, GraphStateSnapshot } from '../GraphManager';
import { UpdateQueue } from '../UpdateQueue';
import { WikiService, LinkWithContext } from '../WikiService';

export type AppSnapshot = {
    graph: GraphStateSnapshot;
    userTypedNodes: string[];
    autoDiscoveredNodes: string[];
    expandedNodes: string[];
    pathNodes: string[];
    nodeThumbnails: Record<string, string>;
    nodeDescriptions: Record<string, string>;
    nodeCategories: Record<string, string[]>;
    nodeBacklinkCounts: Record<string, number>;
};

const INITIAL_SEED_OUTGOING_LIMIT = 9;
const INITIAL_SEED_BACKLINK_LIMIT = 3;

export const useGraphState = () => {
    const getRadialSpawnPosition = (
        anchor: { x: number; y: number },
        index: number,
        total: number,
        baseRadius: number
    ) => {
        const count = Math.max(total, 1);
        const angle = ((index % count) / count) * Math.PI * 2 - Math.PI / 2;
        const ring = Math.floor(index / Math.max(6, count));
        const radius = baseRadius + ring * 54;
        return {
            x: anchor.x + Math.cos(angle) * radius,
            y: anchor.y + Math.sin(angle) * radius,
        };
    };

    // --- Refs ---
    const graphManagerRef = useRef<GraphManager | null>(null);
    const updateQueueRef = useRef<UpdateQueue | null>(null);
    const mutationEpochRef = useRef(0);

    // --- State ---
    const [nodeCount, setNodeCount] = useState<number>(0);
    const [linkCount, setLinkCount] = useState<number>(0);

    const [userTypedNodes, setUserTypedNodes] = useState(new Set<string>());
    const [autoDiscoveredNodes, setAutoDiscoveredNodes] = useState(new Set<string>());
    const [expandedNodes, setExpandedNodes] = useState(new Set<string>());
    const [pathNodes, setPathNodes] = useState(new Set<string>());
    const [recentlyAddedNodes, setRecentlyAddedNodes] = useState(new Set<string>());

    const [pathSelectedNodes, setPathSelectedNodes] = useState<GraphNode[]>([]);
    const [bulkSelectedNodes, setBulkSelectedNodes] = useState<GraphNode[]>([]);

    const [nodeThumbnails, setNodeThumbnails] = useState<Record<string, string>>({});
    const [nodeDescriptions, setNodeDescriptions] = useState<Record<string, string>>({});
    const [nodeCategories, setNodeCategories] = useState<Record<string, string[]>>({});
    const [nodeBacklinkCounts, setNodeBacklinkCounts] = useState<Record<string, number>>({});

    const [clickedNode, setClickedNode] = useState<GraphNode | null>(null);
    const [clickedSummary, setClickedSummary] = useState('');

    // --- History ---
    const undoStackRef = useRef<AppSnapshot[]>([]);
    const redoStackRef = useRef<AppSnapshot[]>([]);
    const suppressHistoryRef = useRef(false);
    const MAX_HISTORY = 30;

    const createSnapshot = (): AppSnapshot | null => {
        if (!graphManagerRef.current) return null;
        return {
            graph: graphManagerRef.current.getStateSnapshot(),
            userTypedNodes: Array.from(userTypedNodes),
            autoDiscoveredNodes: Array.from(autoDiscoveredNodes),
            expandedNodes: Array.from(expandedNodes),
            pathNodes: Array.from(pathNodes),
            nodeThumbnails: { ...nodeThumbnails },
            nodeDescriptions: { ...nodeDescriptions },
            nodeCategories: { ...nodeCategories },
            nodeBacklinkCounts: { ...nodeBacklinkCounts },
        };
    };

    const pushHistory = () => {
        if (suppressHistoryRef.current) return;
        const snap = createSnapshot();
        if (!snap) return;
        undoStackRef.current.push(snap);
        if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
        redoStackRef.current = [];
    };

    const restoreSnapshot = (snap: AppSnapshot) => {
        if (!graphManagerRef.current) return;

        mutationEpochRef.current++;
        updateQueueRef.current?.clear();

        graphManagerRef.current.setStateSnapshot(snap.graph);

        setUserTypedNodes(new Set(snap.userTypedNodes));
        setAutoDiscoveredNodes(new Set(snap.autoDiscoveredNodes));
        setExpandedNodes(new Set(snap.expandedNodes));
        setPathNodes(new Set(snap.pathNodes));
        setNodeThumbnails(snap.nodeThumbnails);
        setNodeDescriptions(snap.nodeDescriptions);
        setNodeCategories(snap.nodeCategories);
        setNodeBacklinkCounts(snap.nodeBacklinkCounts);
        setRecentlyAddedNodes(new Set());

        setBulkSelectedNodes([]);
        setPathSelectedNodes([]);
        setClickedNode(null);
        setClickedSummary('');
    };

    const captureSnapshot = () => createSnapshot();

    const resetGraphState = (options: { clearHistory?: boolean } = {}) => {
        mutationEpochRef.current++;
        updateQueueRef.current?.clear();
        graphManagerRef.current?.clear();

        setUserTypedNodes(new Set());
        setAutoDiscoveredNodes(new Set());
        setExpandedNodes(new Set());
        setPathNodes(new Set());
        setRecentlyAddedNodes(new Set());
        setPathSelectedNodes([]);
        setBulkSelectedNodes([]);
        setNodeThumbnails({});
        setNodeDescriptions({});
        setNodeCategories({});
        setNodeBacklinkCounts({});
        setClickedNode(null);
        setClickedSummary('');

        if (options.clearHistory) {
            undoStackRef.current = [];
            redoStackRef.current = [];
        }
    };

    const undo = () => {
        const prev = undoStackRef.current.pop();
        if (!prev) return;
        const current = createSnapshot();
        if (current) redoStackRef.current.push(current);
        restoreSnapshot(prev);
    };

    const redo = () => {
        const next = redoStackRef.current.pop();
        if (!next) return;
        const current = createSnapshot();
        if (current) undoStackRef.current.push(current);
        restoreSnapshot(next);
    };

    // --- Logic ---

    const addTopic = async (title: string, includeBacklinks: boolean, setLoading?: (v: boolean) => void, setError?: (v: string) => void) => {
        if (!title.trim()) {
            if (setError) setError('Please enter a topic');
            return;
        }
        if (!updateQueueRef.current) return;
        if (setLoading) setLoading(true);
        if (setError) setError('');

        const epoch = mutationEpochRef.current;

        try {
            const resolvedTitle = await WikiService.resolveTitle(title);
            const [links, summaryData, categories, backlinks] = await Promise.all([
                WikiService.fetchLinks(resolvedTitle),
                WikiService.fetchSummary(resolvedTitle),
                WikiService.fetchCategories(resolvedTitle).catch(() => []),
                includeBacklinks ? WikiService.fetchBacklinks(resolvedTitle, 25) : Promise.resolve([]),
            ]);

            if (epoch !== mutationEpochRef.current) return resolvedTitle;
            pushHistory();

            if (summaryData.thumbnail) {
                setNodeThumbnails(prev => ({ ...prev, [resolvedTitle]: summaryData.thumbnail! }));
            }
            if (summaryData.description) {
                setNodeDescriptions(prev => ({ ...prev, [resolvedTitle]: summaryData.description! }));
                graphManagerRef.current?.setNodeMetadata(resolvedTitle, { colorSeed: summaryData.description });
            }
            if (categories.length > 0) {
                setNodeCategories(prev => ({ ...prev, [resolvedTitle]: categories }));
            }
            if (includeBacklinks) {
                setNodeBacklinkCounts(prev => ({ ...prev, [resolvedTitle]: backlinks.length }));
            }

            setUserTypedNodes(prev => new Set([...prev, resolvedTitle]));
            const existingNodeCount = graphManagerRef.current?.getNodeIds().length || 0;
            const isInitialSeed = existingNodeCount === 0;
            const visibleLinks = isInitialSeed ? links.slice(0, INITIAL_SEED_OUTGOING_LIMIT) : links;
            const visibleBacklinks = isInitialSeed ? backlinks.slice(0, INITIAL_SEED_BACKLINK_LIMIT) : backlinks;
            const viewportCenter = graphManagerRef.current?.getViewportCenter() || { x: 0, y: 0 };
            const rootAngle = existingNodeCount * 0.85;
            const rootRadius = existingNodeCount === 0 ? 0 : Math.min(260, 90 + existingNodeCount * 14);
            const rootPosition = {
                x: viewportCenter.x + Math.cos(rootAngle) * rootRadius,
                y: viewportCenter.y + Math.sin(rootAngle) * rootRadius,
            };
            const spawnCount = Math.max(visibleLinks.length + visibleBacklinks.length, 1);
            let spawnIndex = 0;

            const newNodes: GraphNode[] = [{
                id: resolvedTitle,
                title: resolvedTitle,
                x: rootPosition.x,
                y: rootPosition.y,
                metadata: { originSeed: resolvedTitle, originDepth: 0, colorRole: 'root' }
            }];
            const newLinks: Link[] = [];
            const newAutoDiscovered = new Set<string>();

            visibleLinks.forEach((linkObj: LinkWithContext) => {
                const position = getRadialSpawnPosition(rootPosition, spawnIndex, spawnCount, 130);
                spawnIndex++;
                newNodes.push({
                    id: linkObj.title,
                    title: linkObj.title,
                    x: position.x,
                    y: position.y,
                    metadata: { originSeed: resolvedTitle, originDepth: 1, colorRole: 'child' }
                });
                newAutoDiscovered.add(linkObj.title);
                newLinks.push({
                    source: resolvedTitle,
                    target: linkObj.title,
                    id: `${resolvedTitle}-${linkObj.title}`,
                    type: 'manual',
                    context: linkObj.context
                });
            });

            visibleBacklinks.forEach((blTitle: string) => {
                if (!blTitle || blTitle === resolvedTitle) return;
                const position = getRadialSpawnPosition(rootPosition, spawnIndex, spawnCount, 130);
                spawnIndex++;
                newNodes.push({
                    id: blTitle,
                    title: blTitle,
                    x: position.x,
                    y: position.y,
                    metadata: { originSeed: resolvedTitle, originDepth: 1, colorRole: 'child' }
                });
                newAutoDiscovered.add(blTitle);
                newLinks.push({
                    source: blTitle,
                    target: resolvedTitle,
                    id: `${blTitle}-${resolvedTitle}`,
                    type: 'backlink',
                });
            });

            setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));

            // Auto-connect existing
            const graphNodeIds = new Set(graphManagerRef.current?.getNodeIds() || []);
            WikiService.getCachedNodes().forEach(existingNodeId => {
                if (!graphNodeIds.has(existingNodeId)) return;
                const cachedLinks = WikiService.getLinksFromCache(existingNodeId);
                const match = cachedLinks?.find(l => l.title === resolvedTitle);
                if (match) {
                    newLinks.push({
                        source: existingNodeId,
                        target: resolvedTitle,
                        id: `${existingNodeId}-${resolvedTitle}`,
                        type: 'auto',
                        context: match.context
                    });
                }
            });

            if (epoch !== mutationEpochRef.current) return resolvedTitle;
            updateQueueRef.current.queueUpdate(newNodes, newLinks);

            return resolvedTitle;
        } catch (err: any) {
            console.error('Add topic error:', err);
            if (setError) setError(err.message || 'Failed to fetch Wikipedia data');
            throw err;
        } finally {
            if (setLoading) setLoading(false);
        }
    };

    const deleteNodeImperative = (nodeId: string) => {
        pushHistory();
        if (graphManagerRef.current) {
            graphManagerRef.current.deleteNode(nodeId);
        }
        const deleteFromSet = (prev: Set<string>) => { const s = new Set(prev); s.delete(nodeId); return s; };
        const deleteFromMap = <T,>(prev: Record<string, T>) => {
            const next = { ...prev };
            delete next[nodeId];
            return next;
        };
        setUserTypedNodes(deleteFromSet);
        setAutoDiscoveredNodes(deleteFromSet);
        setExpandedNodes(deleteFromSet);
        setPathNodes(deleteFromSet);
        setRecentlyAddedNodes(deleteFromSet);
        setNodeThumbnails(deleteFromMap);
        setNodeDescriptions(deleteFromMap);
        setNodeCategories(deleteFromMap);
        setNodeBacklinkCounts(deleteFromMap);

        if (clickedNode?.id === nodeId) {
            setClickedNode(null);
        }
    };

    const pruneGraph = (setError?: (msg: string) => void) => {
        const ids = bulkSelectedNodes.map(n => n.id);
        if (ids.length === 0) {
            if (setError) setError('No bulk selection to delete (Alt+Drag).');
            return;
        }

        if (!graphManagerRef.current) return;
        pushHistory();

        ids.forEach(id => graphManagerRef.current!.deleteNode(id));
        const deletedIds = new Set(ids);
        setBulkSelectedNodes([]);
        setPathSelectedNodes(prev => prev.filter(n => !deletedIds.has(n.id)));

        const removeFromSet = (prev: Set<string>) => {
            const s = new Set(prev);
            ids.forEach(id => s.delete(id));
            return s;
        };
        const removeFromMap = <T,>(prev: Record<string, T>) => {
            const next = { ...prev };
            ids.forEach(id => delete next[id]);
            return next;
        };

        setPathNodes(removeFromSet);
        setUserTypedNodes(removeFromSet);
        setAutoDiscoveredNodes(removeFromSet);
        setExpandedNodes(removeFromSet);
        setRecentlyAddedNodes(removeFromSet);
        setNodeThumbnails(removeFromMap);
        setNodeDescriptions(removeFromMap);
        setNodeCategories(removeFromMap);
        setNodeBacklinkCounts(removeFromMap);

        if (clickedNode && deletedIds.has(clickedNode.id)) setClickedNode(null);

        // Callbacks for extra cleanup if needed
        if (setError) setError(`Deleted ${ids.length} selected nodes.`);
    };

    const pruneLeafNodes = (setError?: (msg: string) => void) => {
        if (!graphManagerRef.current) return;
        pushHistory();
        const idsToDelete = graphManagerRef.current
            .getNodeIds()
            .filter(id => graphManagerRef.current!.getNodeDegree(id) < 2);
        const deletedCount = graphManagerRef.current.pruneNodes();

        if (deletedCount > 0) {
            const deletedIds = new Set(idsToDelete);
            const removeFromSet = (prev: Set<string>) => {
                const next = new Set(prev);
                idsToDelete.forEach(id => next.delete(id));
                return next;
            };
            const removeFromMap = <T,>(prev: Record<string, T>) => {
                const next = { ...prev };
                idsToDelete.forEach(id => delete next[id]);
                return next;
            };

            setPathSelectedNodes(prev => prev.filter(node => !deletedIds.has(node.id)));
            setBulkSelectedNodes(prev => prev.filter(node => !deletedIds.has(node.id)));
            setUserTypedNodes(removeFromSet);
            setAutoDiscoveredNodes(removeFromSet);
            setExpandedNodes(removeFromSet);
            setPathNodes(removeFromSet);
            setRecentlyAddedNodes(removeFromSet);
            setNodeThumbnails(removeFromMap);
            setNodeDescriptions(removeFromMap);
            setNodeCategories(removeFromMap);
            setNodeBacklinkCounts(removeFromMap);

            if (clickedNode && deletedIds.has(clickedNode.id)) {
                setClickedNode(null);
                setClickedSummary('');
            }
        }

        if (deletedCount > 0) {
            if (setError) setError(`Pruned ${deletedCount} leaf nodes (degree < 2).`);
        } else {
            if (setError) setError('No leaf nodes found to prune.');
        }
    };

    const expandNode = async (title: string, includeBacklinks: boolean, setLoading?: (v: boolean) => void, setError?: (v: string) => void) => {
        if (expandedNodes.has(title)) {
            setExpandedNodes(prev => { const s = new Set(prev); s.delete(title); return s; });
            return;
        }
        if (setLoading) setLoading(true);

        const epoch = mutationEpochRef.current;

        try {
            const [linksWithContext, backlinks, categories] = await Promise.all([
                WikiService.fetchLinks(title),
                includeBacklinks ? WikiService.fetchBacklinks(title, 30) : Promise.resolve([]),
                WikiService.fetchCategories(title).catch(() => []),
            ]);

            if (epoch !== mutationEpochRef.current) return;
            pushHistory();

            const gm = graphManagerRef.current;
            const originMeta = gm?.getNodeMetadata(title);
            const originSeed = originMeta?.originSeed || title;
            const originDepthBase = originMeta?.originDepth ?? 0;
            const existingGraphNodeIds = new Set(gm?.getNodeIds() || []);
            const originPosition = gm?.getNodePosition(title) || gm?.getViewportCenter() || { x: 0, y: 0 };

            if (categories.length > 0) setNodeCategories(prev => ({ ...prev, [title]: categories }));
            if (includeBacklinks) setNodeBacklinkCounts(prev => ({ ...prev, [title]: backlinks.length }));

            const boldSet = new Set(WikiService.getBoldLinkTitlesFromCache(title) || []);
            const backlinkSet = new Set(backlinks);
            const outSet = new Set(linksWithContext.map(l => l.title));

            const sourceCategories = categories.length > 0 ? categories : (nodeCategories[title] || []);
            const sharedCategoryCount = (candidateTitle: string) => {
                const candidateCategories = nodeCategories[candidateTitle];
                if (!candidateCategories || candidateCategories.length === 0) return 0;
                if (!sourceCategories || sourceCategories.length === 0) return 0;
                const set = new Set(candidateCategories);
                let count = 0;
                for (const c of sourceCategories) {
                    if (set.has(c)) count++;
                }
                return count;
            };

            type Candidate = { title: string; direction: 'out' | 'in'; context?: string; isBold: boolean; isBidirectional: boolean; sharedCats: number };
            const candidates: Candidate[] = [];

            linksWithContext.forEach(linkObj => {
                const candidateTitle = linkObj.title;
                if (!candidateTitle || candidateTitle === title) return;
                candidates.push({
                    title: candidateTitle,
                    direction: 'out',
                    context: linkObj.context,
                    isBold: boldSet.has(candidateTitle),
                    isBidirectional: backlinkSet.has(candidateTitle),
                    sharedCats: sharedCategoryCount(candidateTitle),
                });
            });

            backlinks.forEach((blTitle: string) => {
                if (!blTitle || blTitle === title) return;
                if (outSet.has(blTitle)) return; // bidirectional already represented via outgoing link
                candidates.push({
                    title: blTitle,
                    direction: 'in',
                    context: undefined,
                    isBold: false,
                    isBidirectional: false,
                    sharedCats: sharedCategoryCount(blTitle),
                });
            });

            const scoreOf = (c: Candidate) => {
                const inGraph = existingGraphNodeIds.has(c.title);
                const degree = inGraph ? (gm?.getNodeDegree(c.title) || 0) : 0;
                return (
                    degree * 10 +
                    (inGraph ? 20 : 10) +
                    (c.direction === 'in' ? 15 : 0) +
                    (c.isBidirectional ? 35 : 0) +
                    (c.isBold ? 12 : 0) +
                    (c.sharedCats * 15)
                );
            };

            const sortedCandidates = candidates
                .sort((a, b) => scoreOf(b) - scoreOf(a))
                .slice(0, 15);
            const nodesToAdd: GraphNode[] = [];
            const linksToAdd: Link[] = [];
            const newAutoDiscovered = new Set<string>();

            sortedCandidates.forEach(c => {
                const candidateTitle = c.title;
                const position = getRadialSpawnPosition(originPosition, nodesToAdd.length, sortedCandidates.length, 145);
                nodesToAdd.push({
                    id: candidateTitle,
                    title: candidateTitle,
                    x: position.x,
                    y: position.y,
                    metadata: { originSeed, originDepth: originDepthBase + 1, colorRole: 'child' }
                });
                newAutoDiscovered.add(candidateTitle);

                if (c.direction === 'out') {
                    linksToAdd.push({
                        source: title,
                        target: candidateTitle,
                        id: `${title}-${candidateTitle}`,
                        type: c.isBidirectional ? 'expand_backlink' : 'expand',
                        context: c.context
                    });
                } else {
                    linksToAdd.push({
                        source: candidateTitle,
                        target: title,
                        id: `${candidateTitle}-${title}`,
                        type: 'expand_backlink',
                    });
                }

                existingGraphNodeIds.forEach(existing => {
                    if (existing === title) return;
                    const existingLinks = WikiService.getLinksFromCache(existing);
                    const match = existingLinks?.find(l => l.title === candidateTitle);
                    if (match) linksToAdd.push({
                        source: existing,
                        target: candidateTitle,
                        id: `${existing}-${candidateTitle}`,
                        type: 'auto',
                        context: match.context
                    });
                });
            });

            if (nodesToAdd.length === 0) {
                if (setError) setError('No relevant connections found.');
            } else {
                if (epoch !== mutationEpochRef.current) return;
                if (updateQueueRef.current) updateQueueRef.current.queueUpdate(nodesToAdd, linksToAdd);
                if (newAutoDiscovered.size > 0) setAutoDiscoveredNodes(prev => new Set([...prev, ...newAutoDiscovered]));
                setExpandedNodes(prev => new Set([...prev, title]));
            }
        } catch {
            if (setError) setError(`Failed to expand ${title}`);
        } finally {
            if (setLoading) setLoading(false);
        }
    };

    return {
        // Refs
        graphManagerRef,
        updateQueueRef,
        mutationEpochRef,

        // State
        nodeCount, setNodeCount,
        linkCount, setLinkCount,
        userTypedNodes, setUserTypedNodes,
        autoDiscoveredNodes, setAutoDiscoveredNodes,
        expandedNodes, setExpandedNodes,
        pathNodes, setPathNodes,
        recentlyAddedNodes,
        setRecentlyAddedNodes,
        pathSelectedNodes, setPathSelectedNodes,
        bulkSelectedNodes, setBulkSelectedNodes,
        nodeThumbnails, setNodeThumbnails,
        nodeDescriptions, setNodeDescriptions,
        nodeCategories, setNodeCategories,
        nodeBacklinkCounts, setNodeBacklinkCounts,
        clickedNode, setClickedNode,
        clickedSummary, setClickedSummary,

        // Methods
        addTopic,
        expandNode,
        deleteNodeImperative,
        pruneGraph,
        pruneLeafNodes,
        undo,
        redo,
        pushHistory,
        captureSnapshot,
        resetGraphState,
        restoreSnapshot,
    };
};

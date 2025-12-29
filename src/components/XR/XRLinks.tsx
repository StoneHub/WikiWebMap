import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphState } from '../../hooks/useGraphState';
import { useXRGraph } from '../../hooks/useXRGraph';

type XRLinksProps = {
    graphState: ReturnType<typeof useGraphState>;
    xrGraph: ReturnType<typeof useXRGraph>;
};

export const XRLinks = ({ graphState, xrGraph }: XRLinksProps) => {
    const { graphManagerRef } = graphState;
    const { xrNodes } = xrGraph;
    const linesRef = useRef<THREE.LineSegments>(null);

    // Re-calculate the topology (which nodes connect to which) when the graph structure changes
    // We use a version or derived state to trigger this. 
    // For now, we'll assume graphManagerRef.current.getLinks() is enough source of truth.

    const links = useMemo(() => {
        if (!graphManagerRef.current) return [];
        return graphManagerRef.current.getLinks();
    }, [graphState.linkCount]); // Re-run when link count changes

    // Create geometry buffers
    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        // 2 points per link, 3 coords per point
        const positions = new Float32Array(links.length * 2 * 3);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return geo;
    }, [links.length]);

    useFrame(() => {
        if (!linesRef.current || !graphManagerRef.current) return;

        const positions = linesRef.current.geometry.attributes.position.array as Float32Array;
        let i = 0;

        // Update positions every frame
        links.forEach(link => {
            const sId = typeof link.source === 'object' ? link.source.id : link.source;
            const tId = typeof link.target === 'object' ? link.target.id : link.target;

            const sourceNode = xrNodes.get(sId);
            const targetNode = xrNodes.get(tId);

            if (sourceNode && targetNode) {
                positions[i++] = sourceNode.position.x;
                positions[i++] = sourceNode.position.y;
                positions[i++] = sourceNode.position.z;

                positions[i++] = targetNode.position.x;
                positions[i++] = targetNode.position.y;
                positions[i++] = targetNode.position.z;
            } else {
                // Hide degenerate links (shouldn't happen often)
                positions[i++] = 0; positions[i++] = 0; positions[i++] = 0;
                positions[i++] = 0; positions[i++] = 0; positions[i++] = 0;
            }
        });

        linesRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <lineSegments ref={linesRef} geometry={geometry}>
            <lineBasicMaterial color="#555555" transparent opacity={0.3} depthWrite={false} />
        </lineSegments>
    );
};

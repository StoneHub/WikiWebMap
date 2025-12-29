import { useRef, useState, useEffect } from 'react';
import { useGraphState } from './useGraphState';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Simple types for 3D node state
type XRNodeState = {
    id: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    mass: number;
};

export const useXRGraph = (graphState: ReturnType<typeof useGraphState>) => {
    const { graphManagerRef } = graphState;

    // Create a map to track 3D positions separate from D3's 2D positions
    // But initialize them from D3 if possible
    const xrNodes = useRef<Map<string, XRNodeState>>(new Map());
    const [version, setVersion] = useState(0);

    // Sync with 2D graph changes
    useEffect(() => {
        if (!graphManagerRef.current) return;

        // On every D3 tick or update, we might normally sync. 
        // For XR, we want to perform our OWN 3D layout, but seed from 2D.
        const nodes = graphManagerRef.current.getNodes();
        let changed = false;

        // Remove old nodes
        const currentIds = new Set(nodes.map(n => n.id));
        for (const [id] of xrNodes.current) {
            if (!currentIds.has(id)) {
                xrNodes.current.delete(id);
                changed = true;
            }
        }

        // Add new nodes
        nodes.forEach(n => {
            if (!xrNodes.current.has(n.id)) {
                // Spawn in front of user (0, 1.5, -2) roughly
                // Add random jitter
                const x = (Math.random() - 0.5) * 1;
                const y = 1.6 + (Math.random() - 0.5) * 0.5;
                const z = -1.5 + (Math.random() - 0.5) * 0.5;

                xrNodes.current.set(n.id, {
                    id: n.id,
                    position: new THREE.Vector3(x, y, z),
                    velocity: new THREE.Vector3(0, 0, 0),
                    mass: 1
                });
                changed = true;
            }
        });

        if (changed) setVersion(v => v + 1);

    }, [graphManagerRef.current?.getNodes().length]); // Simple dependency on count for now

    // Physics Loop (Force Directed Graph in 3D)
    useFrame((state, delta) => {
        const nodes = Array.from(xrNodes.current.values());
        const links = graphManagerRef.current?.getLinks() || [];

        // Constants
        const REPULSION = 1.5;
        const ATTRACTION = 1.0;
        const DAMPING = 0.95;
        const CENTER_GRAVITY = 0.05;
        const CENTER = new THREE.Vector3(0, 1.6, -1.0); // Eye-ish level, slightly forward

        // 1. Repulsion (Nodes push apart)
        for (let i = 0; i < nodes.length; i++) {
            const n1 = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const n2 = nodes[j];
                const dir = new THREE.Vector3().subVectors(n1.position, n2.position);
                const dist = dir.length();
                if (dist > 0 && dist < 2) { // Only checking close interactions for performance
                    const force = dir.normalize().multiplyScalar(REPULSION / (dist * dist));
                    n1.velocity.add(force.multiplyScalar(delta));
                    n2.velocity.sub(force.multiplyScalar(delta));
                }
            }
        }

        // 2. Attraction (Connected nodes pull)
        links.forEach(link => {
            const sid = typeof link.source === 'object' ? link.source.id : link.source;
            const tid = typeof link.target === 'object' ? link.target.id : link.target;
            const source = xrNodes.current.get(sid);
            const target = xrNodes.current.get(tid);

            if (source && target) {
                const dir = new THREE.Vector3().subVectors(target.position, source.position);
                const dist = dir.length();
                const force = dir.normalize().multiplyScalar((dist - 0.3) * ATTRACTION); // 0.3 is rest length
                source.velocity.add(force.multiplyScalar(delta));
                target.velocity.sub(force.multiplyScalar(delta));
            }
        });

        // 3. Center Gravity & Update
        nodes.forEach(node => {
            const toCenter = new THREE.Vector3().subVectors(CENTER, node.position);
            node.velocity.add(toCenter.multiplyScalar(CENTER_GRAVITY * delta));

            node.velocity.multiplyScalar(DAMPING);
            node.position.add(node.velocity.clone().multiplyScalar(delta));

            // Floor constraint (don't fall through floor)
            if (node.position.y < 0.1) {
                node.position.y = 0.1;
                node.velocity.y *= -0.5; // Bounce
            }
        });
    });

    return {
        xrNodes: xrNodes.current,
        version // Use to trigger React renders when node count changes
    };
};

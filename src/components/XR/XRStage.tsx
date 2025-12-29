import React from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, createXRStore } from '@react-three/xr';
import { OrbitControls, Stars } from '@react-three/drei';
import { useGraphState } from '../../hooks/useGraphState';
import { useXRGraph } from '../../hooks/useXRGraph';
import { XRNode } from './XRNode';
import * as THREE from 'three';

const store = createXRStore();

type XRStageContentProps = {
    graphState: ReturnType<typeof useGraphState>;
};

const XRStageContent = ({ graphState }: XRStageContentProps) => {
    const { xrNodes } = useXRGraph(graphState);

    return (
        <>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            {/* Render Nodes */}
            {Array.from(xrNodes.values()).map(node => (
                <XRNode
                    key={node.id}
                    id={node.id}
                    title={node.id} // Or look up title if different
                    position={node.position}
                    velocity={node.velocity}
                    onClick={() => {
                        console.log('Clicked 3D node:', node.id);
                        graphState.expandNode(node.id, false, undefined, undefined);
                    }}
                />
            ))}

            {/* Render Connections (Simple Lines) */}
            {/* Note: This is a placeholder. Real dynamic lines need to read positions every frame. 
                For efficiency, we might move this to a component that uses useFrame to update link geometry.
            */}
        </>
    );
};

export const XRStage = ({ graphState }: XRStageContentProps) => {
    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 50 }}>
            {/* VR Button Overlay */}
            <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 100 }}>
                <button
                    onClick={() => store.enterAR()}
                    className="px-4 py-2 bg-blue-600 rounded text-white font-bold hover:bg-blue-500 transition-colors mr-2"
                >
                    Enter AR
                </button>
                <button
                    onClick={() => store.enterVR()}
                    className="px-4 py-2 bg-purple-600 rounded text-white font-bold hover:bg-purple-500 transition-colors"
                >
                    Enter VR
                </button>
            </div>

            <Canvas>
                <XR store={store}>
                    <XRStageContent graphState={graphState} />
                    <OrbitControls makeDefault />
                </XR>
            </Canvas>
        </div>
    );
};

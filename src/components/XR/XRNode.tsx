import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

type XRNodeProps = {
    id: string;
    title: string;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    color?: string;
    onClick: () => void;
};

export const XRNode = ({ id, title, position, velocity, color = '#0088ff', onClick }: XRNodeProps) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHover] = useState(false);

    // Smooth interpolation for position updates from the physics engine
    useFrame((state, delta) => {
        if (meshRef.current) {
            // Lerp towards current physics position with a bit of lag for smoothness
            meshRef.current.position.lerp(position, 10 * delta);
        }
    });

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        // Simple "Push" - apply velocity away from click point (or random)
        velocity.y += 2;
        velocity.x += (Math.random() - 0.5) * 2;
        velocity.z += (Math.random() - 0.5) * 2;
    };

    return (
        <group>
            <mesh
                ref={meshRef}
                position={position}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                onPointerDown={handlePointerDown}
                onPointerOver={() => setHover(true)}
                onPointerOut={() => setHover(false)}
            >
                <sphereGeometry args={[0.08, 32, 32]} />
                <meshStandardMaterial
                    color={hovered ? '#ffaa00' : color}
                    emissive={hovered ? '#ffaa00' : color}
                    emissiveIntensity={0.5}
                    roughness={0.3}
                    metalness={0.8}
                />
            </mesh>

            {/* Floating Label */}
            <mesh position={[position.x, position.y + 0.15, position.z]}>
                <Text
                    fontSize={0.08}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                    billboard
                >
                    {title}
                </Text>
            </mesh>
        </group>
    );
};

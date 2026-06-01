import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as random from 'maath/random';

function Stars(props) {
    const ref = useRef();
    const [sphere] = useMemo(() => {
        const positions = random.inSphere(new Float32Array(5000), { radius: 1.5 });
        // Verify we have no NaNs
        for (let i = 0; i < positions.length; i++) {
            if (isNaN(positions[i])) positions[i] = 0;
        }
        return [positions];
    }, []);

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x -= delta / 10;
            ref.current.rotation.y -= delta / 15;
        }
    });

    return (
        <group rotation={[0, 0, Math.PI / 4]}>
            <Points ref={ref} positions={sphere} stride={3} frustumCulled={false} {...props}>
                <PointMaterial
                    transparent
                    color="#4f46e5"
                    size={0.004}
                    sizeAttenuation={true}
                    depthWrite={false}
                />
            </Points>
        </group>
    );
}

export default function ParticleBackground() {
    return (
        <div className="absolute inset-0 z-0 bg-transparent">
            <Canvas camera={{ position: [0, 0, 1] }}>
                <Stars />
            </Canvas>
        </div>
    );
}
import React, { useEffect, useState } from 'react';

interface Props {
    isSpeaking: boolean;
}

const AIAudioVisualizer: React.FC<Props> = ({ isSpeaking }) => {
    // 5 bars
    const [heights, setHeights] = useState<number[]>([10, 15, 20, 15, 10]);

    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isSpeaking) {
            interval = setInterval(() => {
                // Randomize heights to mimic voice activity
                setHeights(prev => prev.map(() => Math.floor(Math.random() * 40) + 10));
            }, 100);
        } else {
            // Reset to idle state
            setHeights([10, 15, 20, 15, 10]);
        }

        return () => clearInterval(interval);
    }, [isSpeaking]);

    return (
        <div className="flex items-end justify-center gap-1 h-16">
            {heights.map((h, i) => (
                <div
                    key={i}
                    className="w-2 bg-white/80 rounded-full transition-all duration-100 ease-in-out shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                    style={{ height: `${h}px` }}
                />
            ))}
        </div>
    );
};

export default AIAudioVisualizer;

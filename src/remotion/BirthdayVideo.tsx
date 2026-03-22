import React, { useMemo } from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig, Audio, staticFile, spring } from 'remotion';

const ConfettiPiece: React.FC<{
  x: number;
  size: number;
  color: string;
  rotation: number;
  delay: number;
}> = ({ x, size, color, rotation, delay }) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  
  const loopDuration = 180; 
  const relativeFrame = (frame - delay + loopDuration * 10) % loopDuration;
  
  const drop = interpolate(relativeFrame, [0, loopDuration], [-50, height + 50]);
  const drift = Math.sin(frame / 30 + x) * 15;
  const spin = rotation + frame * 3;

  return (
    <div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: size / 4,
        transform: `translate3d(${x + drift}px, ${drop}px, 0) rotate(${spin}deg)`,
        willChange: 'transform',
      }}
    />
  );
};

const BurstParticle: React.FC<{
  angle: number;
  distance: number;
  size: number;
  color: string;
  delay: number;
  x: number;
  y: number;
}> = ({ angle, distance, size, color, delay, x, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  // Only render if active (within 1 second of delay)
  if (frame < delay || frame > delay + fps || progress >= 0.99) return null;

  const currentDistance = progress * distance;
  const opacity = interpolate(progress, [0.6, 1], [1, 0]);
  const moveX = Math.cos(angle) * currentDistance;
  const moveY = Math.sin(angle) * currentDistance;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: '50%',
        opacity,
        transform: `translate3d(${moveX}px, ${moveY}px, 0) scale(${1 - progress})`,
        willChange: 'transform, opacity',
      }}
    />
  );
};

const CelebrationBurst: React.FC<{ x: number; y: number; delay: number }> = ({ x, y, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Optimization: Don't even run the memo if the burst isn't active
  const isActive = frame >= delay && frame <= delay + fps;
  
  const particles = useMemo(() => {
    if (!isActive) return [];
    const colors = ['#fde047', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f97316'];
    return Array.from({ length: 12 }).map((_, i) => ({
      angle: (i / 12) * Math.PI * 2,
      distance: 80 + Math.random() * 120,
      size: 6 + Math.random() * 6,
      color: colors[i % colors.length],
    }));
  }, [isActive]);

  if (!isActive) return null;

  return (
    <>
      {particles.map((p, i) => (
        <BurstParticle key={i} {...p} x={x} y={y} delay={delay} />
      ))}
    </>
  );
};

export const BirthdayVideo: React.FC<{ studentName?: string }> = ({ studentName = 'Student' }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const confetti = useMemo(() => {
    const colors = ['#fde047', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f97316'];
    return Array.from({ length: 40 }).map((_, i) => ({
      x: Math.random() * width,
      size: 8 + Math.random() * 8,
      color: colors[i % colors.length],
      rotation: Math.random() * 360,
      delay: Math.random() * 180,
    }));
  }, [width]);

  const bursts = useMemo(() => {
    const list = [];
    // Burst every 2 seconds for better performance
    for (let i = 0; i < durationInFrames; i += 60) {
      list.push({ 
        x: (0.2 + Math.random() * 0.6) * width, 
        y: (0.3 + Math.random() * 0.4) * height, 
        delay: i + 10
      });
    }
    return list;
  }, [width, height, durationInFrames]);

  const opacity = interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: 'clamp' });
  const scale = interpolate(frame, [15, 45], [0.5, 1.1], { extrapolateRight: 'clamp' });
  const bounce = Math.sin(frame / 6) * 8;

  const safeName = (studentName || 'Student').toUpperCase();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a3d54', overflow: 'hidden' }}>
      <Audio src={staticFile("birthday.mp3")} volume={1} />

      <Img 
        src="https://i.postimg.cc/90ZYL8B1/Gemini_Generated_Image_4gcrp4gcrp4gcrp4.png" 
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        referrerPolicy="no-referrer"
      />

      {confetti.map((c, i) => (
        <ConfettiPiece key={i} {...c} />
      ))}

      {bursts.map((b, i) => (
        <CelebrationBurst key={i} {...b} />
      ))}
      
      <div style={{
        position: 'absolute',
        top: `${height * 0.61}px`, // 1180 / 1920 is roughly 0.61
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
      }}>
        <div style={{
          fontSize: `${width * 0.055}px`, // 60 / 1080 is roughly 0.055
          fontWeight: 900,
          color: '#FFFFFF',
          textAlign: 'center',
          fontFamily: "'Fredoka', sans-serif",
          opacity,
          transform: `translate3d(0, ${bounce}px, 0) scale(${scale})`,
          textShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
          maxWidth: '95%',
          whiteSpace: 'nowrap',
          lineHeight: 1.2,
          padding: '20px',
          willChange: 'transform, opacity',
        }}>
          {safeName}
        </div>
      </div>
    </AbsoluteFill>
  );
};

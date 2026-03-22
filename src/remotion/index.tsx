import React from 'react';
import { registerRoot, Composition, staticFile } from 'remotion';
import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { BirthdayVideo } from './BirthdayVideo';
import '../index.css';

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BirthdayVideo"
        component={BirthdayVideo}
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={async ({ props }) => {
          try {
            let audioPath = staticFile('birthday.mp3');
            
            // If on server, try to use absolute path
            if (typeof window === 'undefined') {
              const path = await import('path');
              audioPath = path.join(process.cwd(), 'public', 'birthday.mp3');
            }
            
            console.log("Calculating duration for:", audioPath);
            const duration = await getAudioDurationInSeconds(audioPath);
            console.log("Detected duration:", duration);
            return {
              durationInFrames: Math.ceil(duration * 30),
              props,
            };
          } catch (e) {
            console.error("Could not get audio duration, falling back to 5 seconds:", e);
            return {
              durationInFrames: 150,
              props,
            };
          }
        }}
        defaultProps={{
          studentName: 'Student'
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);

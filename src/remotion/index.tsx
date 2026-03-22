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
        fps={24}
        width={720}
        height={1280}
        calculateMetadata={async () => {
          try {
            const duration = await getAudioDurationInSeconds(staticFile('birthday.mp3'));
            // Cap at 10 seconds for speed
            const cappedDuration = Math.min(duration, 10);
            return {
              durationInFrames: Math.ceil(cappedDuration * 24),
            };
          } catch (e) {
            console.error("Could not get audio duration, falling back to 5 seconds:", e);
            return {
              durationInFrames: 120,
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

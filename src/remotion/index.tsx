import React from 'react';
import { registerRoot, Composition, staticFile } from 'remotion';
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
        calculateMetadata={async ({ props }) => {
          return {
            durationInFrames: (props as any).durationInFrames || 30 * 24,
          };
        }}
        defaultProps={{
          studentName: 'Student',
          durationInFrames: 30 * 24
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);

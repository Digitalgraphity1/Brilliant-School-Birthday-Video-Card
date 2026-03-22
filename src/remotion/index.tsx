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
        width={720}
        height={1280}
        durationInFrames={439} // 14.63 seconds * 30 fps
        defaultProps={{
          studentName: 'Student'
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);

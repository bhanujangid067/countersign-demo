import { Composition } from "remotion";
import { CountersignVideo } from "./CountersignVideo";
import { TOTAL } from "./timing";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CountersignDemo"
      component={CountersignVideo}
      durationInFrames={TOTAL}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

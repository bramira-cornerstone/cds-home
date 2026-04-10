import { useMemo, useState } from "react";
import Spline from "@splinetool/react-spline";
import { useMuxStream } from "@/hooks/useMuxStream";
import { cacheBustedUrl } from "@/lib/utils";

interface NFTSceneProps {
  nft: any;
  overlayUrl: string | null;
  className?: string;
}

export default function NFTScene({ nft, overlayUrl, className }: NFTSceneProps) {
  const [splineApp, setSplineApp] = useState<any>(null);
  const sceneUrl = useMemo(
    () => cacheBustedUrl("https://prod.spline.design/Fh3Ecz7-H4RQ3dJo/scene.splinecode"),
    [],
  );
  useMuxStream(splineApp, overlayUrl);
  return (
    <div className={className}>
      <Spline
        scene={sceneUrl}
        onLoad={(app: any) => {
          const logObjects = (obj: any, depth = 0) => {
            const prefix = "  ".repeat(depth);
            console.log(`${prefix}- name: ${obj.name || "(no name)"}, id: ${obj.id}, type: ${obj.type}`);
            if (obj.children) {
              obj.children.forEach((child: any) => logObjects(child, depth + 1));
            }
          };

          console.log("=== Spline Scene Objects ===");
          logObjects(app);
          console.log("=== End of Spline Objects ===");

          setSplineApp(app);
        }}
      />
    </div>
  );
}

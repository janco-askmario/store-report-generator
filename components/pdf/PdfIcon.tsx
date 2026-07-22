import {
  Svg,
  Path,
  Circle,
  Line,
  Polyline,
  Polygon,
  Rect,
} from "@react-pdf/renderer";
import { getIcon, type IconElement } from "@/lib/icons";

function El({
  el,
  stroke,
  strokeWidth,
}: {
  el: IconElement;
  stroke: string;
  strokeWidth: number;
}) {
  const common = {
    stroke,
    strokeWidth,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (el.type) {
    case "path":
      return <Path d={el.d} {...common} />;
    case "circle":
      return <Circle cx={el.cx} cy={el.cy} r={el.r} {...common} />;
    case "line":
      return <Line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} {...common} />;
    case "polyline":
      return <Polyline points={el.points} {...common} />;
    case "polygon":
      return <Polygon points={el.points} {...common} />;
    case "rect":
      return (
        <Rect
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={el.rx}
          ry={el.rx}
          {...common}
        />
      );
  }
}

export function PdfIcon({
  name,
  size = 18,
  color = "#1b1725",
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const def = getIcon(name);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {def.elements.map((el, i) => (
        <El key={i} el={el} stroke={color} strokeWidth={strokeWidth} />
      ))}
    </Svg>
  );
}

import { getIcon, type IconElement } from "@/lib/icons";

function renderEl(el: IconElement, i: number) {
  switch (el.type) {
    case "path":
      return <path key={i} d={el.d} />;
    case "circle":
      return <circle key={i} cx={el.cx} cy={el.cy} r={el.r} />;
    case "line":
      return <line key={i} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} />;
    case "polyline":
      return <polyline key={i} points={el.points} />;
    case "polygon":
      return <polygon key={i} points={el.points} />;
    case "rect":
      return (
        <rect
          key={i}
          x={el.x}
          y={el.y}
          width={el.width}
          height={el.height}
          rx={el.rx}
          ry={el.rx}
        />
      );
  }
}

export function Icon({
  name,
  size = 24,
  strokeWidth = 2,
  className,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const def = getIcon(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {def.elements.map(renderEl)}
    </svg>
  );
}

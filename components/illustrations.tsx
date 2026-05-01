import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { HG } from '@/theme/tokens';

type IllProps = { size?: number };

export function IllTrdelnik({ size = 80 }: IllProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Ellipse cx={50} cy={86} rx={22} ry={3} fill={HG.ink} opacity={0.1} />
      <Rect x={48} y={14} width={4} height={68} rx={1.5} fill={HG.inkSoft} />
      <Ellipse cx={50} cy={50} rx={22} ry={26} fill={HG.peach} stroke={HG.ink} strokeWidth={2} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Path
          key={i}
          d={`M 28 ${30 + i * 10} Q 50 ${26 + i * 10} 72 ${30 + i * 10}`}
          stroke={HG.redInk}
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      ))}
      <Circle cx={38} cy={36} r={1.5} fill={HG.cream} />
      <Circle cx={60} cy={44} r={1.5} fill={HG.cream} />
      <Circle cx={42} cy={58} r={1.5} fill={HG.cream} />
      <Circle cx={58} cy={68} r={1.5} fill={HG.cream} />
      <G transform="translate(60, 18)">
        <Path d="M0 0 L20 0 L24 5 L20 10 L0 10 Z" fill={HG.red} stroke={HG.ink} strokeWidth={1.5} />
        <SvgText x={10} y={7.5} textAnchor="middle" fontSize={6} fill={HG.cream} fontWeight="700">
          350Kč
        </SvgText>
      </G>
    </Svg>
  );
}

export function IllTaxi({ size = 80 }: IllProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Ellipse cx={50} cy={82} rx={34} ry={3} fill={HG.ink} opacity={0.1} />
      <Path
        d="M14 64 Q14 48 22 44 L34 32 Q38 28 44 28 L66 28 Q72 28 76 34 L84 46 Q86 50 86 56 L86 68 Q86 72 82 72 L74 72 L18 72 Q14 72 14 68 Z"
        fill={HG.amberSoft}
        stroke={HG.ink}
        strokeWidth={2}
      />
      <Rect x={42} y={20} width={16} height={8} rx={1} fill={HG.red} stroke={HG.ink} strokeWidth={1.5} />
      <SvgText x={50} y={27} textAnchor="middle" fontSize={6} fill={HG.cream} fontWeight="700">
        TAXI
      </SvgText>
      <Path d="M36 34 L44 34 L44 46 L34 46 Z" fill={HG.sky} stroke={HG.ink} strokeWidth={1.5} />
      <Path d="M48 34 L66 34 L72 46 L48 46 Z" fill={HG.sky} stroke={HG.ink} strokeWidth={1.5} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={i} x={20 + i * 10} y={56} width={5} height={5} fill={i % 2 ? HG.ink : HG.cream} />
      ))}
      <Rect x={20} y={56} width={60} height={5} fill="none" stroke={HG.ink} strokeWidth={1.5} />
      <Circle cx={30} cy={74} r={8} fill={HG.ink} />
      <Circle cx={30} cy={74} r={3} fill={HG.amberSoft} />
      <Circle cx={70} cy={74} r={8} fill={HG.ink} />
      <Circle cx={70} cy={74} r={3} fill={HG.amberSoft} />
    </Svg>
  );
}

export function IllExchange({ size = 80 }: IllProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Ellipse cx={50} cy={86} rx={32} ry={3} fill={HG.ink} opacity={0.1} />
      <Rect x={18} y={34} width={64} height={48} rx={2} fill={HG.lilac} stroke={HG.ink} strokeWidth={2} />
      <Path d="M14 34 L50 18 L86 34 Z" fill={HG.red} stroke={HG.ink} strokeWidth={2} />
      <Rect x={24} y={40} width={52} height={12} rx={1} fill={HG.cream} stroke={HG.ink} strokeWidth={1.5} />
      <SvgText x={50} y={48.5} textAnchor="middle" fontSize={7} fill={HG.ink} fontWeight="700">
        0% COMMISSION
      </SvgText>
      <SvgText x={50} y={56} textAnchor="middle" fontSize={3.5} fill={HG.red}>
        * worst rates in town
      </SvgText>
      <Rect x={32} y={60} width={36} height={18} rx={1} fill={HG.butter} stroke={HG.ink} strokeWidth={1.5} />
      <Rect x={36} y={64} width={12} height={8} rx={1} fill={HG.greenSoft} stroke={HG.ink} strokeWidth={1} />
      <SvgText x={42} y={70} textAnchor="middle" fontSize={4} fill={HG.ink} fontWeight="700">
        BYR
      </SvgText>
      <Rect x={52} y={64} width={12} height={8} rx={1} fill={HG.greenSoft} stroke={HG.ink} strokeWidth={1} />
      <SvgText x={58} y={70} textAnchor="middle" fontSize={4} fill={HG.ink} fontWeight="700">
        BYR
      </SvgText>
    </Svg>
  );
}

export function IllMenu({ size = 80 }: IllProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Ellipse cx={50} cy={86} rx={28} ry={3} fill={HG.ink} opacity={0.1} />
      <Rect x={22} y={14} width={56} height={70} rx={3} fill={HG.cream} stroke={HG.ink} strokeWidth={2} />
      <SvgText x={50} y={28} textAnchor="middle" fontSize={9} fill={HG.ink} fontStyle="italic">
        Menu
      </SvgText>
      <Line x1={30} y1={34} x2={70} y2={34} stroke={HG.ink} strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => (
        <G key={i} transform={`translate(0, ${42 + i * 10})`}>
          <Rect x={30} y={0} width={22} height={3} fill={HG.inkMute} />
          <Rect x={60} y={0} width={10} height={3} fill={HG.red} />
        </G>
      ))}
      <Rect
        x={56}
        y={48}
        width={36}
        height={42}
        rx={2}
        fill={HG.peach}
        stroke={HG.ink}
        strokeWidth={2}
        transform="rotate(8 74 69)"
      />
      <SvgText
        x={74}
        y={60}
        textAnchor="middle"
        fontSize={6}
        fill={HG.redInk}
        fontWeight="700"
        transform="rotate(8 74 69)"
      >
        +TIPS 18%
      </SvgText>
    </Svg>
  );
}

export function IllPickpocket({ size = 80 }: IllProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Ellipse cx={50} cy={86} rx={34} ry={3} fill={HG.ink} opacity={0.1} />
      <Rect x={14} y={34} width={72} height={40} rx={6} fill={HG.rose} stroke={HG.ink} strokeWidth={2} />
      <Rect x={20} y={40} width={14} height={14} rx={2} fill={HG.sky} stroke={HG.ink} strokeWidth={1.5} />
      <Rect x={38} y={40} width={14} height={14} rx={2} fill={HG.sky} stroke={HG.ink} strokeWidth={1.5} />
      <Rect x={56} y={40} width={14} height={14} rx={2} fill={HG.sky} stroke={HG.ink} strokeWidth={1.5} />
      <SvgText x={78} y={50} fontSize={10} fontWeight="700" fill={HG.ink}>
        22
      </SvgText>
      <Line x1={14} y1={62} x2={86} y2={62} stroke={HG.ink} strokeWidth={1} />
      <Circle cx={28} cy={76} r={4} fill={HG.ink} />
      <Circle cx={72} cy={76} r={4} fill={HG.ink} />
      <Rect
        x={6}
        y={20}
        width={14}
        height={9}
        rx={1.5}
        fill={HG.amber}
        stroke={HG.ink}
        strokeWidth={1.5}
        transform="rotate(-20 13 24)"
      />
      <Path
        d="M 22 28 Q 14 30 8 26"
        stroke={HG.ink}
        strokeWidth={1.5}
        fill="none"
        strokeDasharray="2 2"
      />
    </Svg>
  );
}

export function IllOnline({ size = 80 }: IllProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Ellipse cx={50} cy={86} rx={28} ry={3} fill={HG.ink} opacity={0.1} />
      <Rect x={32} y={14} width={36} height={70} rx={6} fill={HG.mint} stroke={HG.ink} strokeWidth={2} />
      <Rect x={36} y={22} width={28} height={48} rx={2} fill={HG.cream} stroke={HG.ink} strokeWidth={1} />
      <Rect x={38} y={26} width={24} height={14} rx={2} fill={HG.rose} stroke={HG.ink} strokeWidth={1} />
      <SvgText x={50} y={32} textAnchor="middle" fontSize={3.5} fill={HG.ink} fontWeight="700">
        DPD: pay 35Kč
      </SvgText>
      <SvgText x={50} y={37} textAnchor="middle" fontSize={3.5} fill={HG.red}>
        bit.ly/d-pd
      </SvgText>
      <Path d="M 50 50 Q 50 60 56 60 L 56 56" stroke={HG.red} strokeWidth={2} fill="none" />
      <Circle cx={56} cy={60} r={2} fill={HG.red} />
      <Circle cx={50} cy={78} r={2} fill={HG.ink} />
    </Svg>
  );
}

export function IllPragueSkyline({ width = 400, height = 70 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 400 70" preserveAspectRatio="xMidYEnd meet" fill="none">
      <G fill={HG.lilac} stroke={HG.ink} strokeWidth={1.5}>
        <Path d="M0 70 L0 50 L30 50 L30 30 L40 30 L40 22 L48 22 L48 30 L60 30 L60 18 L66 12 L72 18 L72 30 L82 30 L82 50 L100 50 L100 70 Z" />
        <Path d="M120 70 L120 28 L130 28 L130 16 L140 16 L140 28 L150 28 L150 70 Z" />
        <Path d="M150 70 L150 50 Q160 38 170 50 L170 50 Q180 38 190 50 L190 50 Q200 38 210 50 L210 50 Q220 38 230 50 L230 50 Q240 38 250 50 L250 70 Z" />
        <Path d="M250 70 L250 26 L262 26 L262 14 L272 14 L272 26 L284 26 L284 70 Z" />
        <Path d="M284 70 L284 44 L300 44 L300 30 L308 30 L308 22 L314 22 L314 30 L322 30 L322 44 L340 44 L340 70 Z" />
        <Path d="M340 70 L340 38 L348 38 L348 24 L352 16 L356 24 L356 38 L364 38 L364 24 L368 16 L372 24 L372 38 L380 38 L380 70 Z" />
        <Path d="M380 70 L380 50 L400 50 L400 70 Z" />
      </G>
      {[20, 40, 80, 134, 268, 305, 348, 365].map((x, i) => (
        <Rect key={i} x={x} y={i % 2 ? 40 : 50} width={2} height={3} fill={HG.ink} />
      ))}
    </Svg>
  );
}

export function JanekAvatar({ size = 40 }: IllProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <Circle cx={30} cy={30} r={29} fill={HG.amberSoft} stroke={HG.ink} strokeWidth={2} />
      <Path d="M14 26 Q14 14 30 14 Q46 14 46 26 L44 30 Q44 22 30 22 Q16 22 16 30 Z" fill={HG.ink} />
      <Circle cx={30} cy={34} r={13} fill={HG.peach} />
      <Circle cx={24} cy={33} r={4} fill="none" stroke={HG.ink} strokeWidth={1.5} />
      <Circle cx={36} cy={33} r={4} fill="none" stroke={HG.ink} strokeWidth={1.5} />
      <Line x1={28} y1={33} x2={32} y2={33} stroke={HG.ink} strokeWidth={1.5} />
      <Path d="M26 40 Q30 42 34 40" stroke={HG.ink} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Circle cx={48} cy={44} r={6} fill={HG.red} stroke={HG.ink} strokeWidth={1.5} />
      <Rect x={46} y={42} width={4} height={5} rx={1.5} fill={HG.cream} />
    </Svg>
  );
}

export type CatKey = 'taxi' | 'exchange' | 'menu' | 'online' | 'pickpocket' | 'trdelnik';

export function CatIll({ cat, size = 56 }: { cat: CatKey; size?: number }) {
  const map: Record<CatKey, React.FC<IllProps>> = {
    taxi: IllTaxi,
    exchange: IllExchange,
    menu: IllMenu,
    online: IllOnline,
    pickpocket: IllPickpocket,
    trdelnik: IllTrdelnik,
  };
  const C = map[cat] || IllTrdelnik;
  return <C size={size} />;
}

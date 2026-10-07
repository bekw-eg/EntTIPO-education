"use client";

import React, { useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Layers, Eye, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { uiText } from '@/lib/i18n/messages';
import { translateContent } from '@/lib/i18n/content';

export type GeometryFigureType =
  | "pyramid_4"
  | "pyramid_3"
  | "prism"
  | "cone"
  | "cylinder"
  | "sphere"
  | "right_triangle"
  | "triangle"
  | "trapezoid"
  | "circle_tangent"
  | "trig_circle";

export interface GeometryConfig {
  type: GeometryFigureType;
  title?: string;
  labels?: Record<string, string>; // e.g. { H: "12", a: "10", L: "13" }
  showDimensions?: boolean;
  highlightPart?: "height" | "base" | "apothem" | "section" | "radius";
}

interface GeometryViewerProps {
  config: GeometryConfig;
  className?: string;
}

export function GeometryViewer({ config, className = "" }: GeometryViewerProps) {
  const { locale } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [activeHighlight, setActiveHighlight] = useState<string | undefined>(
    config.highlightPart
  );
  const [rotationView, setRotationView] = useState<"front" | "isometric" | "top">("isometric");

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 1.8));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.6));
  const handleReset = () => {
    setZoom(1);
    setRotationView("isometric");
  };

  const labels = config.labels || {};

  return (
    <div className={`relative min-w-0 border rounded-lg overflow-hidden bg-card ${className}`}>
      {/* Top Header bar with title & controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40 text-xs">
        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-primary" />
          <span className="font-semibold text-foreground/90">
            {locale === 'kk' ? translateContent(config.title || getFigureTitle(config.type)) ?? uiText(config.title || getFigureTitle(config.type), locale) : config.title || getFigureTitle(config.type)}
          </span>

        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowLabels(!showLabels)}
            className={`h-11 w-11 ${showLabels ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
            title={uiText('Переключить подписи', locale)} aria-label={uiText('Переключить подписи', locale)}
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-11 w-11 text-muted-foreground hover:text-foreground"
            title={uiText('Уменьшить', locale)} aria-label={uiText('Уменьшить', locale)}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-11 w-11 text-muted-foreground hover:text-foreground"
            title={uiText('Увеличить', locale)} aria-label={uiText('Увеличить', locale)}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="h-11 w-11 text-muted-foreground hover:text-foreground"
            title={uiText('Сброс', locale)} aria-label={uiText('Сброс', locale)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative flex items-center justify-center p-4 min-h-[220px] bg-muted/20 overflow-hidden">
        <div
          className="transition-transform duration-200 origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          {renderSvgFigure(config.type, {
            showLabels,
            labels,
            highlight: activeHighlight,
            rotation: rotationView,
          })}
        </div>

        {/* Floating Quick Badges / Parts Selector */}
        {getAvailableParts(config.type).length > 0 && (
          <div className="absolute bottom-2 inset-x-2 flex flex-wrap items-center gap-1 bg-card px-2 py-1 rounded-md border text-xs">
            <Layers className="w-3 h-3 text-muted-foreground mr-1" />
            <span className="text-muted-foreground mr-1">{uiText('Выделить:', locale)}</span>
            {getAvailableParts(config.type).map((part) => (
              <button
                key={part.id}
                onClick={() =>
                  setActiveHighlight(activeHighlight === part.id ? undefined : part.id)
                }
                className={`min-h-11 px-2 py-1 rounded-md text-xs transition-colors ${
                  activeHighlight === part.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "hover:bg-muted text-foreground/80"
                }`}
              >
                {uiText(part.name, locale)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getFigureTitle(type: GeometryFigureType): string {
  switch (type) {
    case "pyramid_4":
      return "Правильная четырёхугольная пирамида";
    case "pyramid_3":
      return "Правильная треугольная пирамида (Тетраэдр)";
    case "prism":
      return "Прямая призма / Параллелепипед";
    case "cone":
      return "Прямой круговой конус";
    case "cylinder":
      return "Прямой круговой цилиндр";
    case "sphere":
      return "Сфера и сечение плоскостью";
    case "right_triangle":
      return "Прямоугольный треугольник";
    case "triangle":
      return "Треугольник и высота";
    case "trapezoid":
      return "Равнобедренная трапеция";
    case "circle_tangent":
      return "Окружность и касательная";
    case "trig_circle":
      return "Единичный тригонометрический круг";
    default:
      return "Геометрический чертёж";
  }
}

function getAvailableParts(type: GeometryFigureType): { id: string; name: string }[] {
  switch (type) {
    case "pyramid_4":
    case "pyramid_3":
      return [
        { id: "height", name: "Высота H" },
        { id: "apothem", name: "Апофема h" },
        { id: "base", name: "Основание" },
      ];
    case "cone":
      return [
        { id: "height", name: "Высота H" },
        { id: "radius", name: "Радиус R" },
        { id: "apothem", name: "Образующая L" },
      ];
    case "cylinder":
      return [
        { id: "height", name: "Высота H" },
        { id: "radius", name: "Радиус R" },
        { id: "section", name: "Осевое сечение" },
      ];
    case "right_triangle":
      return [
        { id: "height", name: "Высота h_c" },
        { id: "base", name: "Гипотенуза" },
      ];
    default:
      return [];
  }
}

interface SvgRenderOptions {
  showLabels: boolean;
  labels: Record<string, string>;
  highlight?: string;
  rotation: "front" | "isometric" | "top";
}

function renderSvgFigure(type: GeometryFigureType, opts: SvgRenderOptions) {
  const { showLabels, labels, highlight } = opts;
  const strokeColor = "currentColor";
  const primaryColor = "#2563eb";
  const accentColor = "#f59e0b";
  const dashedColor = "#94a3b8";

  switch (type) {
    case "pyramid_4":
      return (
        <svg width="260" height="200" viewBox="0 0 260 200" className="text-foreground">
          {/* Base ABCD */}
          <polygon
            points="40,150 110,120 220,120 150,150"
            fill={highlight === "base" ? "rgba(37,99,235,0.15)" : "none"}
            stroke={highlight === "base" ? primaryColor : strokeColor}
            strokeWidth={highlight === "base" ? "2.5" : "1.8"}
          />
          {/* Hidden base back edges: A(40,150) -> B(110,120) & B(110,120) -> C(220,120) */}
          <line x1="40" y1="150" x2="110" y2="120" stroke={dashedColor} strokeDasharray="4 3" strokeWidth="1.5" />
          <line x1="110" y1="120" x2="220" y2="120" stroke={dashedColor} strokeDasharray="4 3" strokeWidth="1.5" />

          {/* Top vertex S(130, 30) */}
          {/* Edges SA, SD, SC */}
          <line x1="130" y1="30" x2="40" y2="150" stroke={strokeColor} strokeWidth="2" />
          <line x1="130" y1="30" x2="150" y2="150" stroke={strokeColor} strokeWidth="2" />
          <line x1="130" y1="30" x2="220" y2="120" stroke={strokeColor} strokeWidth="2" />
          {/* Hidden edge SB */}
          <line x1="130" y1="30" x2="110" y2="120" stroke={dashedColor} strokeDasharray="4 3" strokeWidth="1.5" />

          {/* Height SO (Center O is approx (130, 135)) */}
          <line
            x1="130"
            y1="30"
            x2="130"
            y2="135"
            stroke={highlight === "height" ? primaryColor : accentColor}
            strokeWidth={highlight === "height" ? "3" : "2"}
            strokeDasharray={highlight === "height" ? "none" : "3 2"}
          />

          {/* Apothem SM (Midpoint M of AD: (95, 150)) */}
          <line
            x1="130"
            y1="30"
            x2="95"
            y2="150"
            stroke={highlight === "apothem" ? "#ef4444" : "#10b981"}
            strokeWidth={highlight === "apothem" ? "3" : "1.8"}
          />

          {/* Right angle markers */}
          <rect x="130" y="125" width="8" height="8" fill="none" stroke={accentColor} strokeWidth="1" />

          {/* Vertices & Labels */}
          {showLabels && (
            <g className="text-xs font-semibold select-none">
              <text x="127" y="22" fill={strokeColor}>S</text>
              <text x="24" y="156" fill={strokeColor}>A</text>
              <text x="105" y="114" fill={strokeColor}>B</text>
              <text x="226" y="124" fill={strokeColor}>C</text>
              <text x="154" y="158" fill={strokeColor}>D</text>
              <text x="135" y="142" fill={accentColor}>O</text>
              <text x="88" y="162" fill="#10b981">M</text>
              {labels.H && (
                <text x="135" y="85" fill={primaryColor} className="text-[11px] font-bold">
                  H = {labels.H}
                </text>
              )}
              {labels.a && (
                <text x="80" y="166" fill={strokeColor} className="text-[11px]">
                  a = {labels.a}
                </text>
              )}
            </g>
          )}
        </svg>
      );

    case "cone":
      return (
        <svg width="240" height="200" viewBox="0 0 240 200" className="text-foreground">
          {/* Base Ellipse */}
          <ellipse
            cx="120"
            cy="150"
            rx="70"
            ry="25"
            fill={highlight === "base" ? "rgba(37,99,235,0.12)" : "none"}
            stroke={strokeColor}
            strokeWidth="1.8"
          />
          {/* Back half dashed */}
          <path
            d="M 50 150 A 70 25 0 0 1 190 150"
            fill="none"
            stroke={dashedColor}
            strokeDasharray="4 3"
            strokeWidth="1.5"
          />

          {/* Slant heights */}
          <line
            x1="120"
            y1="35"
            x2="50"
            y2="150"
            stroke={highlight === "apothem" ? "#ef4444" : strokeColor}
            strokeWidth={highlight === "apothem" ? "3" : "2"}
          />
          <line
            x1="120"
            y1="35"
            x2="190"
            y2="150"
            stroke={highlight === "apothem" ? "#ef4444" : strokeColor}
            strokeWidth={highlight === "apothem" ? "3" : "2"}
          />

          {/* Height SO */}
          <line
            x1="120"
            y1="35"
            x2="120"
            y2="150"
            stroke={highlight === "height" ? primaryColor : accentColor}
            strokeWidth={highlight === "height" ? "3" : "2"}
            strokeDasharray="3 2"
          />

          {/* Radius OA */}
          <line
            x1="120"
            y1="150"
            x2="190"
            y2="150"
            stroke={highlight === "radius" ? "#10b981" : strokeColor}
            strokeWidth={highlight === "radius" ? "3" : "1.8"}
          />

          {/* Right angle */}
          <rect x="120" y="142" width="8" height="8" fill="none" stroke={accentColor} strokeWidth="1" />

          {showLabels && (
            <g className="text-xs font-semibold select-none">
              <text x="116" y="26" fill={strokeColor}>S</text>
              <text x="110" y="162" fill={accentColor}>O</text>
              <text x="195" y="154" fill={strokeColor}>A</text>
              {labels.H && (
                <text x="124" y="95" fill={primaryColor} className="text-[11px] font-bold">
                  H = {labels.H}
                </text>
              )}
              {labels.R && (
                <text x="145" y="145" fill="#10b981" className="text-[11px]">
                  R = {labels.R}
                </text>
              )}
              {labels.L && (
                <text x="60" y="95" fill="#ef4444" className="text-[11px] font-bold">
                  L = {labels.L}
                </text>
              )}
            </g>
          )}
        </svg>
      );

    case "cylinder":
      return (
        <svg width="240" height="200" viewBox="0 0 240 200" className="text-foreground">
          {/* Top Ellipse */}
          <ellipse cx="120" cy="45" rx="60" ry="20" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          {/* Bottom Ellipse */}
          <ellipse cx="120" cy="155" rx="60" ry="20" fill="none" stroke={strokeColor} strokeWidth="1.8" />
          {/* Back half of bottom ellipse */}
          <path
            d="M 60 155 A 60 20 0 0 1 180 155"
            fill="none"
            stroke={dashedColor}
            strokeDasharray="4 3"
            strokeWidth="1.5"
          />

          {/* Lateral sides */}
          <line x1="60" y1="45" x2="60" y2="155" stroke={strokeColor} strokeWidth="2" />
          <line x1="180" y1="45" x2="180" y2="155" stroke={strokeColor} strokeWidth="2" />

          {/* Axis / Height */}
          <line
            x1="120"
            y1="45"
            x2="120"
            y2="155"
            stroke={highlight === "height" ? primaryColor : accentColor}
            strokeWidth={highlight === "height" ? "3" : "2"}
            strokeDasharray="3 2"
          />

          {/* Radius top */}
          <line
            x1="120"
            y1="45"
            x2="180"
            y2="45"
            stroke={highlight === "radius" ? "#10b981" : strokeColor}
            strokeWidth="1.8"
          />

          {showLabels && (
            <g className="text-xs font-semibold select-none">
              <text x="116" y="38" fill={strokeColor}>O₁</text>
              <text x="116" y="168" fill={strokeColor}>O₂</text>
              <text x="185" y="48" fill={strokeColor}>A</text>
              {labels.H && (
                <text x="125" y="105" fill={primaryColor} className="text-[11px] font-bold">
                  H = {labels.H}
                </text>
              )}
              {labels.R && (
                <text x="140" y="38" fill="#10b981" className="text-[11px]">
                  R = {labels.R}
                </text>
              )}
            </g>
          )}
        </svg>
      );

    case "right_triangle":
      return (
        <svg width="240" height="180" viewBox="0 0 240 180" className="text-foreground">
          {/* Right triangle ABC (Right angle at C(50, 140)) */}
          <polygon
            points="50,140 200,140 50,40"
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
          />
          {/* Right angle marker at C */}
          <rect x="50" y="126" width="14" height="14" fill="none" stroke={strokeColor} strokeWidth="1.5" />

          {/* Altitude to hypotenuse: from C(50,140) to hypotenuse AB */}
          {/* AB line: y = mx + b. A(50,40), B(200,140). dx=150, dy=100, slope m=2/3 */}
          {/* Altitude foot H: approx (102, 75) */}
          <line
            x1="50"
            y1="140"
            x2="102"
            y2="75"
            stroke={highlight === "height" ? primaryColor : accentColor}
            strokeWidth={highlight === "height" ? "3" : "1.8"}
            strokeDasharray="3 2"
          />

          {showLabels && (
            <g className="text-xs font-semibold select-none">
              <text x="44" y="32" fill={strokeColor}>A</text>
              <text x="36" y="152" fill={strokeColor}>C</text>
              <text x="206" y="146" fill={strokeColor}>B</text>
              <text x="108" y="70" fill={accentColor}>H</text>
              {labels.a && <text x="120" y="155" fill={strokeColor}>a = {labels.a}</text>}
              {labels.b && <text x="22" y="95" fill={strokeColor}>b = {labels.b}</text>}
              {labels.c && <text x="135" y="80" fill={primaryColor}>c = {labels.c}</text>}
            </g>
          )}
        </svg>
      );

    case "trig_circle":
    default:
      return (
        <svg width="240" height="200" viewBox="0 0 240 200" className="text-foreground">
          {/* Axes */}
          <line x1="20" y1="100" x2="220" y2="100" stroke={dashedColor} strokeWidth="1.5" />
          <line x1="120" y1="20" x2="120" y2="180" stroke={dashedColor} strokeWidth="1.5" />
          {/* Arrows */}
          <polygon points="220,100 214,97 214,103" fill={dashedColor} />
          <polygon points="120,20 117,26 123,26" fill={dashedColor} />

          {/* Circle */}
          <circle cx="120" cy="100" r="70" fill="none" stroke={strokeColor} strokeWidth="2" />

          {/* 45 degree angle radius */}
          {/* cos(45)=0.707 -> dx=49.5, dy=-49.5 */}
          <line x1="120" y1="100" x2="170" y2="50" stroke={primaryColor} strokeWidth="2" />
          <circle cx="170" cy="50" r="4" fill={primaryColor} />

          {/* Coordinate projections */}
          <line x1="170" y1="50" x2="170" y2="100" stroke={accentColor} strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="170" y1="50" x2="120" y2="50" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 2" />

          {showLabels && (
            <g className="text-xs font-semibold select-none">
              <text x="215" y="115" fill={strokeColor}>cos</text>
              <text x="126" y="24" fill={strokeColor}>sin</text>
              <text x="175" y="46" fill={primaryColor}>P(x, y)</text>
              <text x="135" y="92" fill={strokeColor}>α</text>
              <text x="195" y="115" fill={dashedColor}>1</text>
              <text x="125" y="175" fill={dashedColor}>-1</text>
            </g>
          )}
        </svg>
      );
  }
}

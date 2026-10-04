"use client";
import { uiText, errorText } from "@/lib/i18n/messages";
import { useLanguage } from "@/lib/i18n/LanguageContext";


import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { GeometryViewer, GeometryFigureType } from "@/components/ui/GeometryViewer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MathDisplay } from "@/components/ui/MathDisplay";
import { Box, Triangle, Circle, Layers, BookOpen } from "lucide-react";

interface FigureInfo {
  type: GeometryFigureType;
  name: string;
  category: "3d" | "2d";
  formula: string;
  formulaDescription: string;
  properties: string[];
  defaultLabels: Record<string, string>;
}

const FIGURES_CATALOG: FigureInfo[] = [
  {
    type: "pyramid_4",
    name: "Правильная четырёхугольная пирамида",
    category: "3d",
    formula: "V = \\frac{1}{3} S_{осн} \\cdot H = \\frac{1}{3} a^2 H, \\quad S_{бок} = 2 a \\cdot h_a",
    formulaDescription: "Объём равен одной трети произведения площади основания на высоту. Боковая поверхность равна половине периметра на апофему.",
    properties: [
      "Основание — правильный четырёхугольник (квадрат) со стороной a",
      "Высота H падает точно в центр квадрата O",
      "Связь апофемы: h_a^2 = H^2 + (a/2)^2",
      "Боковое ребро: b^2 = H^2 + (a\\sqrt{2}/2)^2",
    ],
    defaultLabels: { H: "12", a: "10" },
  },
  {
    type: "cone",
    name: "Прямой круговой конус",
    category: "3d",
    formula: "V = \\frac{1}{3} \\pi R^2 H, \\quad S_{бок} = \\pi R L, \\quad S_{полн} = \\pi R (R + L)",
    formulaDescription: "Тело вращения прямоугольного треугольника вокруг одного из его катетов. Связь параметров: L^2 = H^2 + R^2.",
    properties: [
      "Основание — круг радиуса R",
      "Осевое сечение — равнобедренный треугольник с основанием 2R и боковыми сторонами L",
      "Угол развёртки боковой поверхности: \\alpha = 360^\\circ \\cdot (R / L)",
    ],
    defaultLabels: { H: "8", R: "6", L: "10" },
  },
  {
    type: "cylinder",
    name: "Прямой круговой цилиндр",
    category: "3d",
    formula: "V = \\pi R^2 H, \\quad S_{бок} = 2 \\pi R H, \\quad S_{полн} = 2 \\pi R (R + H)",
    formulaDescription: "Тело вращения прямоугольника вокруг одной из его сторон. Осевое сечение — прямоугольник со сторонами 2R и H.",
    properties: [
      "Два параллельных круговых основания радиуса R",
      "Развёртка боковой поверхности — прямоугольник длиной 2\\pi R и высотой H",
      "Диагональ осевого сечения: d^2 = (2R)^2 + H^2",
    ],
    defaultLabels: { H: "15", R: "4" },
  },
  {
    type: "right_triangle",
    name: "Прямоугольный треугольник",
    category: "2d",
    formula: "a^2 + b^2 = c^2, \\quad S = \\frac{1}{2} a b = \\frac{1}{2} c h_c, \\quad h_c = \\frac{a b}{c}",
    formulaDescription: "Теорема Пифагора, метрические соотношения и высота, проведённая к гипотенузе.",
    properties: [
      "Квадрат высоты равен произведению проекций катетов: h_c^2 = a_c \\cdot b_c",
      "Радиус описанной окружности равен половине гипотенузы: R = c / 2",
      "Радиус вписанной окружности: r = (a + b - c) / 2",
    ],
    defaultLabels: { a: "6", b: "8", c: "10" },
  },
  {
    type: "trig_circle",
    name: "Единичный тригонометрический круг",
    category: "2d",
    formula: "\\sin^2(\\alpha) + \\cos^2(\\alpha) = 1, \\quad x = \\cos(\\alpha), \\quad y = \\sin(\\alpha)",
    formulaDescription: "Координаты любой точки на единичной окружности задают значение косинуса (абсцисса) и синуса (ордината).",
    properties: [
      "Радиус окружности R = 1 с центром в начале координат (0, 0)",
      "Ось OX — ось косинусов, ось OY — ось синусов",
      "Периодичность: \\sin(\\alpha + 2\\pi) = \\sin(\\alpha), \\quad \\cos(\\alpha + 2\\pi) = \\cos(\\alpha)",
    ],
    defaultLabels: {},
  },
];

export default function GeometryPage() {
  const { locale } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<"all" | "3d" | "2d">("all");
  const [selectedFigure, setSelectedFigure] = useState<FigureInfo>(FIGURES_CATALOG[0]);

  const filtered =
    activeCategory === "all"
      ? FIGURES_CATALOG
      : FIGURES_CATALOG.filter((f) => f.category === activeCategory);

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title={uiText("Интерактивная геометрия и стереометрия", locale)}
        subtitle={uiText("Чертежи, сечения, формулы объёмов и площадей для заданий ЕНТ", locale)}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top category tabs */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4">
          <Tabs
            value={activeCategory}
            onValueChange={(val) => setActiveCategory(val as any)}
          >
            <TabsList>
              <TabsTrigger value="all" className="gap-2">
                <Layers className="w-4 h-4" />
                {uiText(" Все фигуры ", locale)}</TabsTrigger>
              <TabsTrigger value="3d" className="gap-2">
                <Box className="w-4 h-4" />
                {uiText(" Стереометрия 3D ", locale)}</TabsTrigger>
              <TabsTrigger value="2d" className="gap-2">
                <Triangle className="w-4 h-4" />
                {uiText(" Планиметрия 2D ", locale)}</TabsTrigger>
            </TabsList>
          </Tabs>

          <span className="text-xs text-muted-foreground">
            {uiText(" Интерактивный векторный SVG-рендеринг ", locale)}</span>
        </div>

        {/* Main Content: Interactive Canvas + Figures List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Center: Active Figure Viewer & Theory */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="shadow-sm border overflow-hidden">
              <CardHeader className="bg-muted/20 border-b pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      {selectedFigure.category === "3d" ? uiText("Стереометрия", locale) : uiText("Планиметрия", locale)}
                    </Badge>
                    <CardTitle className="text-xl sm:text-2xl font-bold">
                       {uiText(selectedFigure.name, locale)}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-6">
                {/* Interactive Geometric SVG Viewer */}
                <GeometryViewer
                  config={{
                    type: selectedFigure.type,
                    title: selectedFigure.name,
                    labels: selectedFigure.defaultLabels,
                  }}
                  className="shadow-inner"
                />

                {/* Key Formulas Section */}
                <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <BookOpen className="w-4 h-4" />
                    <span>{uiText("Ключевые формулы ЕНТ:", locale)}</span>
                  </div>
                  <div className="p-3 bg-card rounded-lg border text-center overflow-x-auto shadow-xs">
                    <MathDisplay math={selectedFigure.formula} block />
                  </div>
                  <p className="text-xs text-muted-foreground">
                     {uiText(selectedFigure.formulaDescription, locale)}
                  </p>
                </div>

                {/* Properties list */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground/90">
                    {uiText(" Свойства и закономерности для экзамена: ", locale)}</h4>
                  <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                    {selectedFigure.properties.map((prop, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                         <span>{uiText(prop, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Quick Selection Catalog */}
          <div className="lg:col-span-4 space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {uiText(" Каталог фигур ", locale)}</h3>
            <div className="space-y-2">
              {filtered.map((fig) => {
                const isSelected = selectedFigure.type === fig.type;
                return (
                  <button
                    key={fig.type}
                    onClick={() => setSelectedFigure(fig)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                        : "bg-card hover:bg-muted/50 border-border"
                    }`}
                  >
                    <div className="space-y-1 pr-2 min-w-0">
                      <div className="flex items-center gap-2">
                        {fig.category === "3d" ? (
                          <Box className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Triangle className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        <span className="text-sm font-medium leading-tight truncate">
                           {uiText(fig.name, locale)}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground block line-clamp-1">
                         {uiText(fig.formulaDescription, locale)}
                      </span>
                    </div>
                    <Badge variant={isSelected ? "default" : "outline"} className="text-[10px] shrink-0">
                      {fig.category.toUpperCase()}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

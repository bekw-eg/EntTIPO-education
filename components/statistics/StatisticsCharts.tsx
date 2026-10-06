"use client";

import React from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DailyAccuracy } from "@/types";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface StatisticsChartsProps {
  dailyAccuracy: DailyAccuracy[];
  topicProgress: any[];
}

export function StatisticsCharts({
  dailyAccuracy,
  topicProgress,
}: StatisticsChartsProps) {
  const { t, getTopicName } = useLanguage();

  // Sort topics by mastery score and translate names
  const sortedTopics = [...topicProgress]
    .map((tp) => ({
      name: getTopicName(tp.topic?.name || ""),
      score: tp.masteryScore,
    }))
    .sort((a, b) => b.score - a.score);

  const getBarColor = (_score: number) => "hsl(var(--primary))";

  if (!dailyAccuracy.length && !topicProgress.length) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Accuracy over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.statistics.accuracyDynamicsTitle}</CardTitle>
          <CardDescription>
            {dailyAccuracy.length > 0
              ? t.statistics.accuracyDynamicsDesc
              : t.statistics.notEnoughData}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {dailyAccuracy.length > 0 ? (
            <div className="h-[280px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyAccuracy}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                  />
                  <Tooltip wrapperStyle={{ maxWidth: "min(240px, 100%)" }}
                    formatter={(value: any) => [`${value}%`, t.dashboard.accuracy]}
                    labelFormatter={(label) => `${label}`}
                    contentStyle={{
                      backgroundColor: "rgba(23, 23, 23, 0.9)",
                      borderRadius: "8px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="accuracy"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#accuracyGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground border rounded-lg border-dashed">
              {t.statistics.solveToBuildChart}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Topic mastery comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.statistics.masteryRatingTitle}</CardTitle>
          <CardDescription>
            {t.statistics.masteryRatingDesc}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {sortedTopics.length > 0 ? (
            <div className="h-[280px] w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sortedTopics.slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.15} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip wrapperStyle={{ maxWidth: "min(240px, 100%)" }}
                    formatter={(val: any) => [`${val}%`, t.dashboard.accuracy]}
                    contentStyle={{
                      backgroundColor: "rgba(23, 23, 23, 0.9)",
                      borderRadius: "8px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  />
                  <Bar isAnimationActive={false} dataKey="score" radius={[0, 4, 4, 0]}>
                    {sortedTopics.slice(0, 8).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground border rounded-lg border-dashed">
              {t.statistics.noTopicData}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

package com.flowdash.dto;

import java.util.List;

public record HabitAnalyticsResponse(
        List<HabitResponse> weakHabits,
        List<HabitResponse> bestStreaks,
        List<HabitForecastPointResponse> weeklyLoad,
        List<HabitForecastPointResponse> monthlyTrend
) {
}

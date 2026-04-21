package com.flowdash.dto;

import java.util.List;

public record HabitOverviewResponse(
        HabitStatsResponse stats,
        HabitAnalyticsResponse analytics,
        List<HabitResponse> habits,
        List<HabitResponse> today,
        List<HabitResponse> overdue,
        List<HabitResponse> upcomingReminders
) {
}

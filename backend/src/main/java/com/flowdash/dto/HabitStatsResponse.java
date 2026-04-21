package com.flowdash.dto;

public record HabitStatsResponse(
        long totalHabits,
        long activeHabits,
        long dueToday,
        long completedToday,
        long overdue,
        int todayProgress,
        int weeklyConsistency,
        int monthlyConsistency,
        int activeStreaks,
        int bestStreak
) {
}

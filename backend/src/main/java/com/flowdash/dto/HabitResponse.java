package com.flowdash.dto;

import com.flowdash.domain.HabitScheduleType;
import com.flowdash.domain.HabitType;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record HabitResponse(
        Long id,
        String title,
        String description,
        HabitType habitType,
        HabitScheduleType scheduleType,
        List<Integer> scheduledDays,
        Double targetValue,
        String targetUnit,
        LocalTime reminderTime,
        LocalDate startDate,
        LocalDate endDate,
        List<String> tags,
        String color,
        Integer priority,
        boolean paused,
        boolean archived,
        String cue,
        String routine,
        String reward,
        String friction,
        String identityStatement,
        String notes,
        boolean dueToday,
        boolean overdue,
        String reminderLabel,
        int currentStreak,
        int bestStreak,
        int completionRate,
        long totalCheckins,
        long successfulCheckins,
        HabitCheckinResponse todayCheckin,
        Instant createdAt,
        Instant updatedAt
) {
}

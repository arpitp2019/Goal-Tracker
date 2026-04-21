package com.flowdash.dto;

import com.flowdash.domain.HabitScheduleType;
import com.flowdash.domain.HabitType;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record HabitRequest(
        @NotBlank String title,
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
        Boolean paused,
        Boolean archived,
        String cue,
        String routine,
        String reward,
        String friction,
        String identityStatement,
        String notes
) {
}

package com.flowdash.dto;

import com.flowdash.domain.HabitCheckinStatus;

import java.time.Instant;
import java.time.LocalDate;

public record HabitCheckinResponse(
        Long id,
        Long habitId,
        LocalDate checkinDate,
        HabitCheckinStatus status,
        Double value,
        String note,
        Integer mood,
        Integer energy,
        boolean successful,
        Instant createdAt,
        Instant updatedAt
) {
}

package com.flowdash.dto;

import com.flowdash.domain.HabitCheckinStatus;

import java.time.LocalDate;

public record HabitCheckinRequest(
        LocalDate checkinDate,
        HabitCheckinStatus status,
        Double value,
        String note,
        Integer mood,
        Integer energy
) {
}

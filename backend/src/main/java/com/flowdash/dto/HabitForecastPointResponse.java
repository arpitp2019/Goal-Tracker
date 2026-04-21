package com.flowdash.dto;

import java.time.LocalDate;

public record HabitForecastPointResponse(
        LocalDate date,
        long dueCount,
        long completedCount
) {
}

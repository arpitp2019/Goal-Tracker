package com.flowdash.web;

import com.flowdash.dto.HabitCheckinRequest;
import com.flowdash.dto.HabitCheckinResponse;
import com.flowdash.dto.HabitOverviewResponse;
import com.flowdash.dto.HabitRequest;
import com.flowdash.dto.HabitResponse;
import com.flowdash.service.HabitService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/habits")
public class HabitController {

    private final HabitService habitService;

    public HabitController(HabitService habitService) {
        this.habitService = habitService;
    }

    @GetMapping("/overview")
    public HabitOverviewResponse overview(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return habitService.overview(date);
    }

    @GetMapping
    public List<HabitResponse> list() {
        return habitService.list();
    }

    @PostMapping
    public HabitResponse create(@Valid @RequestBody HabitRequest request) {
        return habitService.create(request);
    }

    @PutMapping("/{id}")
    public HabitResponse update(@PathVariable Long id, @Valid @RequestBody HabitRequest request) {
        return habitService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        habitService.delete(id);
    }

    @PostMapping("/{id}/checkins")
    public HabitCheckinResponse checkIn(@PathVariable Long id, @Valid @RequestBody HabitCheckinRequest request) {
        return habitService.checkIn(id, request);
    }

    @DeleteMapping("/{id}/checkins/{date}")
    public void clearCheckIn(@PathVariable Long id, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        habitService.clearCheckIn(id, date);
    }

    @GetMapping("/{id}/checkins")
    public List<HabitCheckinResponse> checkins(@PathVariable Long id,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return habitService.checkins(id, from, to);
    }
}

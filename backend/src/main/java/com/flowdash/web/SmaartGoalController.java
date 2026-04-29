package com.flowdash.web;

import com.flowdash.domain.SmaartGoalType;
import com.flowdash.domain.SmaartStatus;
import com.flowdash.dto.SmaartGoalDtos.ArchiveResponse;
import com.flowdash.dto.SmaartGoalDtos.CalendarResponse;
import com.flowdash.dto.SmaartGoalDtos.DashboardResponse;
import com.flowdash.dto.SmaartGoalDtos.GoalDetailResponse;
import com.flowdash.dto.SmaartGoalDtos.GoalRequest;
import com.flowdash.dto.SmaartGoalDtos.GoalResponse;
import com.flowdash.dto.SmaartGoalDtos.GoalsListResponse;
import com.flowdash.dto.SmaartGoalDtos.KanbanResponse;
import com.flowdash.dto.SmaartGoalDtos.PrioritiesDashboardResponse;
import com.flowdash.dto.SmaartGoalDtos.PriorityProfileRequest;
import com.flowdash.dto.SmaartGoalDtos.PriorityProfileResponse;
import com.flowdash.dto.SmaartGoalDtos.SprintRequest;
import com.flowdash.dto.SmaartGoalDtos.SprintResponse;
import com.flowdash.dto.SmaartGoalDtos.TaskRequest;
import com.flowdash.dto.SmaartGoalDtos.TaskResponse;
import com.flowdash.dto.SmaartGoalDtos.TaskStatusRequest;
import com.flowdash.service.SmaartGoalService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/smaart-goals")
public class SmaartGoalController {

    private final SmaartGoalService service;

    public SmaartGoalController(SmaartGoalService service) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    public DashboardResponse dashboard() {
        return service.dashboard();
    }

    @GetMapping("/priorities")
    public PrioritiesDashboardResponse priorities() {
        return service.prioritiesDashboard();
    }

    @PutMapping("/priorities/preferences")
    public PriorityProfileResponse updatePriorityProfile(@RequestBody PriorityProfileRequest request) {
        return service.updatePriorityProfile(request);
    }

    @GetMapping("/kanban")
    public KanbanResponse kanban() {
        return service.kanban();
    }

    @GetMapping("/calendar")
    public CalendarResponse calendar(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                     @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.calendar(from, to);
    }

    @GetMapping("/archive")
    public ArchiveResponse archive() {
        return service.archive();
    }

    @GetMapping
    public GoalsListResponse list(@RequestParam(required = false) SmaartGoalType type,
                                  @RequestParam(required = false) SmaartStatus status,
                                  @RequestParam(required = false) String search,
                                  @RequestParam(required = false) Boolean archived) {
        return service.list(type, status, search, archived);
    }

    @PostMapping
    public GoalResponse createGoal(@Valid @RequestBody GoalRequest request) {
        return service.createGoal(request);
    }

    @GetMapping("/{goalId}")
    public GoalDetailResponse detail(@PathVariable Long goalId) {
        return service.detail(goalId);
    }

    @PutMapping("/{goalId}")
    public GoalResponse updateGoal(@PathVariable Long goalId, @Valid @RequestBody GoalRequest request) {
        return service.updateGoal(goalId, request);
    }

    @DeleteMapping("/{goalId}")
    public void deleteGoal(@PathVariable Long goalId) {
        service.deleteGoal(goalId);
    }

    @PostMapping("/{goalId}/archive")
    public GoalResponse archiveGoal(@PathVariable Long goalId) {
        return service.archiveGoal(goalId);
    }

    @PostMapping("/{goalId}/restore")
    public GoalResponse restoreGoal(@PathVariable Long goalId) {
        return service.restoreGoal(goalId);
    }

    @PostMapping("/{goalId}/sprints")
    public SprintResponse createSprint(@PathVariable Long goalId, @Valid @RequestBody SprintRequest request) {
        return service.createSprint(goalId, request);
    }

    @PutMapping("/{goalId}/sprints/{sprintId}")
    public SprintResponse updateSprint(@PathVariable Long goalId, @PathVariable Long sprintId, @Valid @RequestBody SprintRequest request) {
        return service.updateSprint(goalId, sprintId, request);
    }

    @DeleteMapping("/{goalId}/sprints/{sprintId}")
    public void deleteSprint(@PathVariable Long goalId, @PathVariable Long sprintId) {
        service.deleteSprint(goalId, sprintId);
    }

    @PostMapping("/{goalId}/tasks")
    public TaskResponse createGoalTask(@PathVariable Long goalId, @Valid @RequestBody TaskRequest request) {
        return service.createTask(goalId, null, request);
    }

    @PostMapping("/{goalId}/sprints/{sprintId}/tasks")
    public TaskResponse createSprintTask(@PathVariable Long goalId, @PathVariable Long sprintId, @Valid @RequestBody TaskRequest request) {
        return service.createTask(goalId, sprintId, request);
    }

    @PutMapping("/tasks/{taskId}")
    public TaskResponse updateTask(@PathVariable Long taskId, @Valid @RequestBody TaskRequest request) {
        return service.updateTask(taskId, request);
    }

    @PostMapping("/tasks/{taskId}/duplicate")
    public TaskResponse duplicateTask(@PathVariable Long taskId) {
        return service.duplicateTask(taskId);
    }

    @PatchMapping("/tasks/{taskId}/status")
    public TaskResponse updateTaskStatus(@PathVariable Long taskId, @RequestBody TaskStatusRequest request) {
        return service.updateTaskStatus(taskId, request.status());
    }

    @DeleteMapping("/tasks/{taskId}")
    public void deleteTask(@PathVariable Long taskId) {
        service.deleteTask(taskId);
    }
}

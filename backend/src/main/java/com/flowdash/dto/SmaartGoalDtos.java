package com.flowdash.dto;

import com.flowdash.domain.SmaartGoalType;
import com.flowdash.domain.SmaartStatus;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public final class SmaartGoalDtos {

    private SmaartGoalDtos() {
    }

    public record GoalRequest(
            @NotBlank String title,
            String description,
            SmaartGoalType goalType,
            String category,
            Integer priority,
            LocalDate startDate,
            LocalDate deadline,
            SmaartStatus status,
            String motivation,
            String successCriteria,
            String notes,
            String specific,
            String measurable,
            String achievable,
            String actionOriented,
            String relevant,
            String timeBound
    ) {
    }

    public record GoalResponse(
            Long id,
            String title,
            String description,
            SmaartGoalType goalType,
            String category,
            Integer priority,
            LocalDate startDate,
            LocalDate deadline,
            SmaartStatus status,
            String motivation,
            String successCriteria,
            String notes,
            String specific,
            String measurable,
            String achievable,
            String actionOriented,
            String relevant,
            String timeBound,
            Integer progressPercentage,
            String urgency,
            boolean readyToComplete,
            int taskCount,
            int completedTaskCount,
            int sprintCount,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record GoalDetailResponse(
            GoalResponse goal,
            List<SprintResponse> sprints,
            List<TaskResponse> tasks,
            List<ActivityResponse> activity
    ) {
    }

    public record SprintRequest(
            @NotBlank String title,
            String objective,
            LocalDate startDate,
            LocalDate endDate,
            SmaartStatus status,
            String notes
    ) {
    }

    public record SprintResponse(
            Long id,
            Long goalId,
            String goalTitle,
            String title,
            String objective,
            LocalDate startDate,
            LocalDate endDate,
            SmaartStatus status,
            String notes,
            Integer progressPercentage,
            int taskCount,
            int completedTaskCount,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record TaskRequest(
            @NotBlank String title,
            String description,
            Long sprintId,
            SmaartStatus status,
            Integer priority,
            String category,
            LocalDate dueDate,
            Integer estimatedMinutes,
            Integer urgency,
            Integer importance,
            Integer impact,
            Integer effort,
            Boolean completed,
            String tags,
            String notes,
            List<Long> dependencyIds,
            List<String> checklistItems
    ) {
    }

    public record TaskStatusRequest(SmaartStatus status) {
    }

    public record ChecklistItemResponse(
            Long id,
            String title,
            boolean completed
    ) {
    }

    public record TaskResponse(
            Long id,
            Long goalId,
            String goalTitle,
            Long sprintId,
            String sprintTitle,
            String title,
            String description,
            SmaartStatus status,
            Integer priority,
            String category,
            LocalDate dueDate,
            Integer estimatedMinutes,
            Integer urgency,
            Integer importance,
            Integer impact,
            Integer effort,
            Integer deadlinePressure,
            Integer priorityScore,
            String priorityLevel,
            boolean completed,
            String tags,
            String notes,
            List<Long> dependencyIds,
            List<ChecklistItemResponse> checklistItems,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record ActivityResponse(
            Long id,
            Long goalId,
            Long sprintId,
            Long taskId,
            String action,
            String description,
            Instant createdAt
    ) {
    }

    public record DashboardStatsResponse(
            long activeGoals,
            long completedGoals,
            long overdueGoals,
            long overdueTasks,
            int overallProgress
    ) {
    }

    public record DashboardResponse(
            DashboardStatsResponse stats,
            List<TaskResponse> todayFocusTasks,
            List<GoalResponse> upcomingDeadlines,
            List<GoalResponse> atRiskGoals,
            List<SprintResponse> sprintSummary,
            List<ActivityResponse> recentActivity
    ) {
    }

    public record KanbanColumnResponse(
            SmaartStatus status,
            List<TaskResponse> tasks
    ) {
    }

    public record KanbanResponse(
            List<KanbanColumnResponse> columns
    ) {
    }

    public record CalendarEventResponse(
            Long id,
            String type,
            String title,
            LocalDate date,
            LocalDate startDate,
            LocalDate endDate,
            SmaartStatus status,
            String parentGoal,
            String route
    ) {
    }

    public record CalendarResponse(
            LocalDate from,
            LocalDate to,
            List<CalendarEventResponse> events
    ) {
    }

    public record ArchiveResponse(
            List<GoalResponse> goals
    ) {
    }

    public record GoalsListResponse(
            List<GoalResponse> goals,
            Map<String, Long> statusMix,
            Map<String, Long> typeMix
    ) {
    }

    public record PriorityProfileRequest(
            Integer urgencyWeight,
            Integer importanceWeight,
            Integer deadlineWeight,
            Integer effortWeight,
            Integer impactWeight,
            Integer highPriorityThreshold
    ) {
    }

    public record PriorityProfileResponse(
            Integer urgencyWeight,
            Integer importanceWeight,
            Integer deadlineWeight,
            Integer effortWeight,
            Integer impactWeight,
            Integer highPriorityThreshold
    ) {
    }

    public record PrioritiesKpiResponse(
            long totalTasks,
            long highPriorityTasks,
            long overdueTasks,
            long completedTasks
    ) {
    }

    public record PrioritySummaryResponse(
            String label,
            long count
    ) {
    }

    public record PriorityTrendPointResponse(
            String label,
            LocalDate date,
            int totalScore,
            long taskCount,
            long highPriorityCount
    ) {
    }

    public record PriorityFilterOptionsResponse(
            List<String> statuses,
            List<String> categories,
            List<String> priorityLevels,
            List<String> deadlineBuckets
    ) {
    }

    public record GoalOptionResponse(
            Long id,
            String title,
            String category
    ) {
    }

    public record PrioritiesDashboardResponse(
            PrioritiesKpiResponse stats,
            PriorityProfileResponse profile,
            PriorityFilterOptionsResponse filterOptions,
            List<GoalOptionResponse> goalOptions,
            List<PrioritySummaryResponse> statusDistribution,
            List<PrioritySummaryResponse> categoryDistribution,
            List<PrioritySummaryResponse> priorityDistribution,
            List<PriorityTrendPointResponse> priorityTrend,
            List<TaskResponse> tasks
    ) {
    }
}

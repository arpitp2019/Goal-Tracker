package com.flowdash.service;

import com.flowdash.domain.AppUser;
import com.flowdash.domain.SmaartActivityLog;
import com.flowdash.domain.SmaartGoal;
import com.flowdash.domain.SmaartGoalType;
import com.flowdash.domain.SmaartPriorityProfile;
import com.flowdash.domain.SmaartSprint;
import com.flowdash.domain.SmaartStatus;
import com.flowdash.domain.SmaartTask;
import com.flowdash.domain.SmaartTaskChecklistItem;
import com.flowdash.domain.SmaartTaskDependency;
import com.flowdash.dto.SmaartGoalDtos.ActivityResponse;
import com.flowdash.dto.SmaartGoalDtos.ArchiveResponse;
import com.flowdash.dto.SmaartGoalDtos.CalendarEventResponse;
import com.flowdash.dto.SmaartGoalDtos.CalendarResponse;
import com.flowdash.dto.SmaartGoalDtos.ChecklistItemResponse;
import com.flowdash.dto.SmaartGoalDtos.DashboardResponse;
import com.flowdash.dto.SmaartGoalDtos.DashboardStatsResponse;
import com.flowdash.dto.SmaartGoalDtos.GoalDetailResponse;
import com.flowdash.dto.SmaartGoalDtos.GoalRequest;
import com.flowdash.dto.SmaartGoalDtos.GoalResponse;
import com.flowdash.dto.SmaartGoalDtos.GoalsListResponse;
import com.flowdash.dto.SmaartGoalDtos.KanbanColumnResponse;
import com.flowdash.dto.SmaartGoalDtos.KanbanResponse;
import com.flowdash.dto.SmaartGoalDtos.PrioritiesDashboardResponse;
import com.flowdash.dto.SmaartGoalDtos.PrioritiesKpiResponse;
import com.flowdash.dto.SmaartGoalDtos.PriorityFilterOptionsResponse;
import com.flowdash.dto.SmaartGoalDtos.PriorityProfileRequest;
import com.flowdash.dto.SmaartGoalDtos.PriorityProfileResponse;
import com.flowdash.dto.SmaartGoalDtos.PrioritySummaryResponse;
import com.flowdash.dto.SmaartGoalDtos.PriorityTrendPointResponse;
import com.flowdash.dto.SmaartGoalDtos.GoalOptionResponse;
import com.flowdash.dto.SmaartGoalDtos.SprintRequest;
import com.flowdash.dto.SmaartGoalDtos.SprintResponse;
import com.flowdash.dto.SmaartGoalDtos.TaskRequest;
import com.flowdash.dto.SmaartGoalDtos.TaskResponse;
import com.flowdash.repository.SmaartActivityLogRepository;
import com.flowdash.repository.SmaartGoalRepository;
import com.flowdash.repository.SmaartPriorityProfileRepository;
import com.flowdash.repository.SmaartSprintRepository;
import com.flowdash.repository.SmaartTaskChecklistItemRepository;
import com.flowdash.repository.SmaartTaskDependencyRepository;
import com.flowdash.repository.SmaartTaskRepository;
import com.flowdash.security.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class SmaartGoalService {

    private static final PriorityWeights DEFAULT_PRIORITY_WEIGHTS = new PriorityWeights(1, 1, 1, 1, 1, 75);

    private static final List<SmaartStatus> KANBAN_STATUSES = List.of(
            SmaartStatus.BACKLOG,
            SmaartStatus.TODO,
            SmaartStatus.IN_PROGRESS,
            SmaartStatus.BLOCKED,
            SmaartStatus.REVIEW,
            SmaartStatus.COMPLETED
    );
    private static final List<String> PRIORITY_LEVELS = List.of("CRITICAL", "HIGH", "MEDIUM", "LOW");
    private static final List<String> DEADLINE_BUCKETS = List.of("OVERDUE", "TODAY", "THIS_WEEK", "NEXT_TWO_WEEKS", "LATER", "NONE");

    private final SmaartGoalRepository goalRepository;
    private final SmaartPriorityProfileRepository priorityProfileRepository;
    private final SmaartSprintRepository sprintRepository;
    private final SmaartTaskRepository taskRepository;
    private final SmaartTaskChecklistItemRepository checklistRepository;
    private final SmaartTaskDependencyRepository dependencyRepository;
    private final SmaartActivityLogRepository activityRepository;
    private final CurrentUserService currentUserService;

    public SmaartGoalService(SmaartGoalRepository goalRepository,
                             SmaartPriorityProfileRepository priorityProfileRepository,
                             SmaartSprintRepository sprintRepository,
                             SmaartTaskRepository taskRepository,
                             SmaartTaskChecklistItemRepository checklistRepository,
                             SmaartTaskDependencyRepository dependencyRepository,
                             SmaartActivityLogRepository activityRepository,
                             CurrentUserService currentUserService) {
        this.goalRepository = goalRepository;
        this.priorityProfileRepository = priorityProfileRepository;
        this.sprintRepository = sprintRepository;
        this.taskRepository = taskRepository;
        this.checklistRepository = checklistRepository;
        this.dependencyRepository = dependencyRepository;
        this.activityRepository = activityRepository;
        this.currentUserService = currentUserService;
    }

    public DashboardResponse dashboard() {
        Long userId = currentUserService.requireCurrentUserId();
        LocalDate today = today();
        List<SmaartGoal> goals = goalRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
        List<SmaartSprint> sprints = sprintRepository.findAllByUserIdOrderByStartDateAsc(userId);
        List<SmaartTask> tasks = taskRepository.findAllByUserIdOrderByDueDateAscUpdatedAtDesc(userId);
        Snapshot snapshot = snapshot(goals, sprints, tasks);
        PriorityWeights weights = resolvePriorityWeights(userId);

        List<TaskResponse> taskResponses = taskResponses(tasks, snapshot, weights).stream()
                .filter(task -> !task.completed() && task.status() != SmaartStatus.ARCHIVED)
                .sorted(Comparator
                        .comparing(TaskResponse::dueDate, Comparator.nullsLast(LocalDate::compareTo))
                        .thenComparing(TaskResponse::priority, Comparator.reverseOrder()))
                .limit(8)
                .toList();
        List<GoalResponse> goalResponses = goalResponses(goals, snapshot);
        long activeGoals = goalResponses.stream().filter(goal -> isActive(goal.status())).count();
        long completedGoals = goalResponses.stream().filter(goal -> goal.status() == SmaartStatus.COMPLETED).count();
        long overdueGoals = goalResponses.stream().filter(goal -> "Overdue".equals(goal.urgency())).count();
        long overdueTasks = tasks.stream().filter(task -> !isTaskComplete(task) && task.getDueDate() != null && task.getDueDate().isBefore(today)).count();
        int overallProgress = averageProgress(goalResponses);

        return new DashboardResponse(
                new DashboardStatsResponse(activeGoals, completedGoals, overdueGoals, overdueTasks, overallProgress),
                taskResponses,
                goalResponses.stream()
                        .filter(goal -> isActive(goal.status()) && goal.deadline() != null && !goal.deadline().isBefore(today))
                        .sorted(Comparator.comparing(GoalResponse::deadline))
                        .limit(6)
                        .toList(),
                goalResponses.stream()
                        .filter(goal -> List.of("Needs attention", "Behind schedule", "Overdue").contains(goal.urgency()))
                        .limit(6)
                        .toList(),
                sprintResponses(sprints, snapshot).stream()
                        .filter(sprint -> sprint.status() != SmaartStatus.COMPLETED && sprint.status() != SmaartStatus.ARCHIVED)
                        .limit(6)
                        .toList(),
                activityRepository.findTop20ByUserIdOrderByCreatedAtDesc(userId).stream().map(this::activityResponse).toList()
        );
    }

    public PrioritiesDashboardResponse prioritiesDashboard() {
        Long userId = currentUserService.requireCurrentUserId();
        LocalDate today = today();
        PriorityWeights weights = resolvePriorityWeights(userId);
        List<SmaartGoal> goals = goalRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
        List<SmaartSprint> sprints = sprintRepository.findAllByUserIdOrderByStartDateAsc(userId);
        List<SmaartTask> tasks = taskRepository.findAllByUserIdOrderByDueDateAscUpdatedAtDesc(userId);
        Snapshot snapshot = snapshot(goals, sprints, tasks);

        List<TaskResponse> taskResponses = taskResponses(tasks, snapshot, weights).stream()
                .sorted(Comparator
                        .comparing(TaskResponse::priorityScore, Comparator.reverseOrder())
                        .thenComparing(TaskResponse::dueDate, Comparator.nullsLast(LocalDate::compareTo))
                        .thenComparing(TaskResponse::updatedAt, Comparator.reverseOrder()))
                .toList();

        long totalTasks = taskResponses.size();
        long highPriorityTasks = taskResponses.stream()
                .filter(task -> !task.completed() && task.priorityScore() >= weights.highPriorityThreshold())
                .count();
        long overdueTasks = taskResponses.stream()
                .filter(task -> !task.completed() && task.dueDate() != null && task.dueDate().isBefore(today))
                .count();
        long completedTasks = taskResponses.stream().filter(TaskResponse::completed).count();

        List<GoalOptionResponse> goalOptions = goals.stream()
                .filter(goal -> isActive(goal.getStatus()))
                .sorted(Comparator
                        .comparing(SmaartGoal::getDeadline, Comparator.nullsLast(LocalDate::compareTo))
                        .thenComparing(SmaartGoal::getTitle, String.CASE_INSENSITIVE_ORDER))
                .map(goal -> new GoalOptionResponse(goal.getId(), goal.getTitle(), goal.getCategory()))
                .toList();

        List<String> categories = taskResponses.stream()
                .map(task -> categoryLabel(task.category()))
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();

        return new PrioritiesDashboardResponse(
                new PrioritiesKpiResponse(totalTasks, highPriorityTasks, overdueTasks, completedTasks),
                priorityProfileResponse(weights),
                new PriorityFilterOptionsResponse(
                        List.of("BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "ARCHIVED"),
                        categories,
                        PRIORITY_LEVELS,
                        DEADLINE_BUCKETS
                ),
                goalOptions,
                distribution(taskResponses, task -> task.status().name(), List.of("BACKLOG", "TODO", "IN_PROGRESS", "BLOCKED", "REVIEW", "COMPLETED", "ARCHIVED")),
                distribution(taskResponses, task -> categoryLabel(task.category()), categories),
                distribution(taskResponses, TaskResponse::priorityLevel, PRIORITY_LEVELS),
                priorityTrend(taskResponses, today, weights.highPriorityThreshold()),
                taskResponses
        );
    }

    public PriorityProfileResponse updatePriorityProfile(PriorityProfileRequest request) {
        AppUser user = currentUserService.requireCurrentUser();
        SmaartPriorityProfile profile = priorityProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> new SmaartPriorityProfile(user));
        profile.setUrgencyWeight(clampWeight(request == null ? null : request.urgencyWeight(), profile.getUrgencyWeight()));
        profile.setImportanceWeight(clampWeight(request == null ? null : request.importanceWeight(), profile.getImportanceWeight()));
        profile.setDeadlineWeight(clampWeight(request == null ? null : request.deadlineWeight(), profile.getDeadlineWeight()));
        profile.setEffortWeight(clampWeight(request == null ? null : request.effortWeight(), profile.getEffortWeight()));
        profile.setImpactWeight(clampWeight(request == null ? null : request.impactWeight(), profile.getImpactWeight()));
        profile.setHighPriorityThreshold(clampHighPriorityThreshold(request == null ? null : request.highPriorityThreshold(), profile.getHighPriorityThreshold()));
        SmaartPriorityProfile saved = priorityProfileRepository.save(profile);
        return priorityProfileResponse(toPriorityWeights(saved));
    }

    public GoalsListResponse list(SmaartGoalType type, SmaartStatus status, String search, Boolean archived) {
        Long userId = currentUserService.requireCurrentUserId();
        List<SmaartGoal> goals = goalRepository.findAllByUserIdOrderByUpdatedAtDesc(userId).stream()
                .filter(goal -> type == null || goal.getGoalType() == type)
                .filter(goal -> status == null || goal.getStatus() == status)
                .filter(goal -> Boolean.TRUE.equals(archived) || goal.getStatus() != SmaartStatus.ARCHIVED)
                .filter(goal -> matchesSearch(goal, search))
                .toList();
        Snapshot snapshot = snapshot(goals);
        List<GoalResponse> responses = goalResponses(goals, snapshot);
        return new GoalsListResponse(
                responses,
                responses.stream().collect(Collectors.groupingBy(goal -> goal.status().name(), Collectors.counting())),
                responses.stream().collect(Collectors.groupingBy(goal -> goal.goalType().name(), Collectors.counting()))
        );
    }

    public ArchiveResponse archive() {
        List<SmaartGoal> goals = goalRepository.findAllByUserIdOrderByUpdatedAtDesc(currentUserService.requireCurrentUserId()).stream()
                .filter(goal -> goal.getStatus() == SmaartStatus.ARCHIVED || goal.getStatus() == SmaartStatus.COMPLETED)
                .toList();
        return new ArchiveResponse(goalResponses(goals, snapshot(goals)));
    }

    public GoalDetailResponse detail(Long goalId) {
        SmaartGoal goal = requireOwnedGoal(goalId);
        List<SmaartSprint> sprints = sprintRepository.findAllByUserIdAndGoalIdOrderByStartDateAsc(currentUserService.requireCurrentUserId(), goalId);
        List<SmaartTask> tasks = taskRepository.findAllByUserIdAndGoalIdOrderByDueDateAscUpdatedAtDesc(currentUserService.requireCurrentUserId(), goalId);
        Snapshot snapshot = snapshot(List.of(goal), sprints, tasks);
        PriorityWeights weights = resolvePriorityWeights();
        return new GoalDetailResponse(
                goalResponse(goal, snapshot),
                sprintResponses(sprints, snapshot),
                taskResponses(tasks, snapshot, weights),
                activityRepository.findTop30ByUserIdAndGoalIdOrderByCreatedAtDesc(currentUserService.requireCurrentUserId(), goalId).stream()
                        .map(this::activityResponse)
                        .toList()
        );
    }

    public GoalResponse createGoal(GoalRequest request) {
        AppUser user = currentUserService.requireCurrentUser();
        SmaartGoal goal = new SmaartGoal(user, normalizeTitle(request.title()), request.goalType(), normalizeDeadline(request.deadline()));
        applyGoal(goal, request, true);
        SmaartGoal saved = goalRepository.save(goal);
        log(user, saved, null, null, "Created goal", "Created " + saved.getTitle());
        return goalResponse(saved, snapshot(List.of(saved)));
    }

    public GoalResponse updateGoal(Long goalId, GoalRequest request) {
        SmaartGoal goal = requireOwnedGoal(goalId);
        applyGoal(goal, request, false);
        SmaartGoal saved = goalRepository.save(goal);
        log(currentUserService.requireCurrentUser(), saved, null, null, "Updated goal", "Updated " + saved.getTitle());
        return goalResponse(saved, snapshot(List.of(saved)));
    }

    public void deleteGoal(Long goalId) {
        SmaartGoal goal = requireOwnedGoal(goalId);
        goalRepository.delete(goal);
    }

    public GoalResponse archiveGoal(Long goalId) {
        SmaartGoal goal = requireOwnedGoal(goalId);
        goal.setStatus(SmaartStatus.ARCHIVED);
        SmaartGoal saved = goalRepository.save(goal);
        log(currentUserService.requireCurrentUser(), saved, null, null, "Archived goal", saved.getTitle());
        return goalResponse(saved, snapshot(List.of(saved)));
    }

    public GoalResponse restoreGoal(Long goalId) {
        SmaartGoal goal = requireOwnedGoal(goalId);
        if (goal.getStatus() == SmaartStatus.ARCHIVED) {
            goal.setStatus(SmaartStatus.TODO);
        }
        SmaartGoal saved = goalRepository.save(goal);
        log(currentUserService.requireCurrentUser(), saved, null, null, "Restored goal", saved.getTitle());
        return goalResponse(saved, snapshot(List.of(saved)));
    }

    public SprintResponse createSprint(Long goalId, SprintRequest request) {
        SmaartGoal goal = requireOwnedGoal(goalId);
        if (goal.getGoalType() != SmaartGoalType.LONG_TERM) {
            throw new IllegalArgumentException("Sprints are only available for long-term goals");
        }
        AppUser user = currentUserService.requireCurrentUser();
        SmaartSprint sprint = new SmaartSprint(user, goal, normalizeTitle(request.title()));
        applySprint(sprint, request);
        SmaartSprint saved = sprintRepository.save(sprint);
        log(user, goal, saved, null, "Created sprint", "Created " + saved.getTitle());
        return sprintResponse(saved, snapshot(List.of(goal), List.of(saved), List.of()));
    }

    public SprintResponse updateSprint(Long goalId, Long sprintId, SprintRequest request) {
        SmaartSprint sprint = requireOwnedSprint(goalId, sprintId);
        applySprint(sprint, request);
        SmaartSprint saved = sprintRepository.save(sprint);
        log(currentUserService.requireCurrentUser(), saved.getGoal(), saved, null, "Updated sprint", saved.getTitle());
        List<SmaartTask> tasks = taskRepository.findAllByUserIdAndSprintIdOrderByDueDateAscUpdatedAtDesc(currentUserService.requireCurrentUserId(), sprintId);
        return sprintResponse(saved, snapshot(List.of(saved.getGoal()), List.of(saved), tasks));
    }

    public void deleteSprint(Long goalId, Long sprintId) {
        SmaartSprint sprint = requireOwnedSprint(goalId, sprintId);
        sprintRepository.delete(sprint);
    }

    public TaskResponse createTask(Long goalId, Long pathSprintId, TaskRequest request) {
        SmaartGoal goal = requireOwnedGoal(goalId);
        SmaartSprint sprint = resolveSprint(goal, pathSprintId == null ? request.sprintId() : pathSprintId);
        AppUser user = currentUserService.requireCurrentUser();
        SmaartTask task = new SmaartTask(user, goal, sprint, normalizeTitle(request.title()));
        applyTask(task, request);
        SmaartTask saved = taskRepository.save(task);
        replaceChecklist(saved, request.checklistItems());
        replaceDependencies(saved, request.dependencyIds());
        log(user, goal, sprint, saved, "Created task", "Created " + saved.getTitle());
        return taskResponse(saved, snapshot(List.of(goal), sprint == null ? List.of() : List.of(sprint), List.of(saved)), resolvePriorityWeights());
    }

    public TaskResponse updateTask(Long taskId, TaskRequest request) {
        SmaartTask task = requireOwnedTask(taskId);
        SmaartSprint sprint = resolveSprint(task.getGoal(), request.sprintId());
        task.setSprint(sprint);
        applyTask(task, request);
        SmaartTask saved = taskRepository.save(task);
        replaceChecklist(saved, request.checklistItems());
        replaceDependencies(saved, request.dependencyIds());
        log(currentUserService.requireCurrentUser(), saved.getGoal(), saved.getSprint(), saved, "Updated task", saved.getTitle());
        return taskResponse(saved, snapshot(List.of(saved.getGoal()), saved.getSprint() == null ? List.of() : List.of(saved.getSprint()), List.of(saved)), resolvePriorityWeights());
    }

    public TaskResponse duplicateTask(Long taskId) {
        SmaartTask task = requireOwnedTask(taskId);
        AppUser user = currentUserService.requireCurrentUser();
        SmaartTask copy = new SmaartTask(user, task.getGoal(), task.getSprint(), "Copy of " + task.getTitle());
        copy.setDescription(task.getDescription());
        copy.setStatus(SmaartStatus.TODO);
        copy.setPriority(task.getPriority());
        copy.setCategory(task.getCategory());
        copy.setDueDate(task.getDueDate());
        copy.setEstimatedMinutes(task.getEstimatedMinutes());
        copy.setUrgency(task.getUrgency());
        copy.setImportance(task.getImportance());
        copy.setImpact(task.getImpact());
        copy.setEffort(task.getEffort());
        copy.setTags(task.getTags());
        copy.setNotes(task.getNotes());
        SmaartTask saved = taskRepository.save(copy);
        log(user, saved.getGoal(), saved.getSprint(), saved, "Duplicated task", saved.getTitle());
        return taskResponse(saved, snapshot(List.of(saved.getGoal()), saved.getSprint() == null ? List.of() : List.of(saved.getSprint()), List.of(saved)), resolvePriorityWeights());
    }

    public TaskResponse updateTaskStatus(Long taskId, SmaartStatus status) {
        SmaartTask task = requireOwnedTask(taskId);
        setTaskStatus(task, status == null ? SmaartStatus.TODO : status);
        SmaartTask saved = taskRepository.save(task);
        log(currentUserService.requireCurrentUser(), saved.getGoal(), saved.getSprint(), saved, "Moved task", "Moved to " + saved.getStatus());
        return taskResponse(saved, snapshot(List.of(saved.getGoal()), saved.getSprint() == null ? List.of() : List.of(saved.getSprint()), List.of(saved)), resolvePriorityWeights());
    }

    public void deleteTask(Long taskId) {
        SmaartTask task = requireOwnedTask(taskId);
        taskRepository.delete(task);
    }

    public KanbanResponse kanban() {
        Long userId = currentUserService.requireCurrentUserId();
        List<SmaartGoal> goals = goalRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
        List<SmaartSprint> sprints = sprintRepository.findAllByUserIdOrderByStartDateAsc(userId);
        List<SmaartTask> tasks = taskRepository.findAllByUserIdOrderByDueDateAscUpdatedAtDesc(userId).stream()
                .filter(task -> task.getStatus() != SmaartStatus.ARCHIVED)
                .toList();
        Snapshot snapshot = snapshot(goals, sprints, tasks);
        Map<SmaartStatus, List<TaskResponse>> byStatus = taskResponses(tasks, snapshot, resolvePriorityWeights(userId)).stream()
                .collect(Collectors.groupingBy(TaskResponse::status, () -> new EnumMap<>(SmaartStatus.class), Collectors.toList()));
        return new KanbanResponse(KANBAN_STATUSES.stream()
                .map(status -> new KanbanColumnResponse(status, byStatus.getOrDefault(status, List.of())))
                .toList());
    }

    public CalendarResponse calendar(LocalDate from, LocalDate to) {
        LocalDate start = from == null ? today().withDayOfMonth(1) : from;
        LocalDate end = to == null ? start.plusMonths(1).minusDays(1) : to;
        Long userId = currentUserService.requireCurrentUserId();
        List<SmaartGoal> goals = goalRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
        List<SmaartSprint> sprints = sprintRepository.findAllByUserIdOrderByStartDateAsc(userId);
        List<SmaartTask> tasks = taskRepository.findAllByUserIdAndDueDateBetweenOrderByDueDateAsc(userId, start, end);

        List<CalendarEventResponse> events = new java.util.ArrayList<>();
        goals.stream()
                .filter(goal -> goal.getDeadline() != null && !goal.getDeadline().isBefore(start) && !goal.getDeadline().isAfter(end))
                .forEach(goal -> events.add(new CalendarEventResponse(goal.getId(), "GOAL", goal.getTitle(), goal.getDeadline(), goal.getStartDate(), goal.getDeadline(), goal.getStatus(), null, "/goals/" + goal.getId())));
        sprints.stream()
                .filter(sprint -> overlaps(sprint.getStartDate(), sprint.getEndDate(), start, end))
                .forEach(sprint -> events.add(new CalendarEventResponse(sprint.getId(), "SPRINT", sprint.getTitle(), sprint.getEndDate(), sprint.getStartDate(), sprint.getEndDate(), sprint.getStatus(), sprint.getGoal().getTitle(), "/goals/" + sprint.getGoal().getId() + "/sprints/" + sprint.getId())));
        tasks.forEach(task -> events.add(new CalendarEventResponse(task.getId(), "TASK", task.getTitle(), task.getDueDate(), task.getDueDate(), task.getDueDate(), task.getStatus(), task.getGoal().getTitle(), "/goals/" + task.getGoal().getId())));
        events.sort(Comparator.comparing(CalendarEventResponse::date, Comparator.nullsLast(LocalDate::compareTo)));
        return new CalendarResponse(start, end, events);
    }

    private void applyGoal(SmaartGoal goal, GoalRequest request, boolean creating) {
        goal.setTitle(normalizeTitle(request.title()));
        goal.setDescription(normalizeText(request.description()));
        goal.setGoalType(request.goalType() == null ? goal.getGoalType() : request.goalType());
        goal.setCategory(normalizeText(request.category()));
        goal.setPriority(clamp(request.priority(), creating ? 3 : goal.getPriority(), 1, 5));
        goal.setStartDate(request.startDate() == null ? (creating ? today() : goal.getStartDate()) : request.startDate());
        goal.setDeadline(normalizeDeadline(request.deadline() == null ? goal.getDeadline() : request.deadline()));
        goal.setStatus(request.status() == null ? goal.getStatus() : request.status());
        goal.setMotivation(normalizeText(request.motivation()));
        goal.setSuccessCriteria(normalizeText(request.successCriteria()));
        goal.setNotes(normalizeText(request.notes()));
        goal.setSpecific(normalizeText(request.specific()));
        goal.setMeasurable(normalizeText(request.measurable()));
        goal.setAchievable(normalizeText(request.achievable()));
        goal.setActionOriented(normalizeText(request.actionOriented()));
        goal.setRelevant(normalizeText(request.relevant()));
        goal.setTimeBound(normalizeText(request.timeBound()));
    }

    private void applySprint(SmaartSprint sprint, SprintRequest request) {
        sprint.setTitle(normalizeTitle(request.title()));
        sprint.setObjective(normalizeText(request.objective()));
        sprint.setStartDate(request.startDate());
        sprint.setEndDate(request.endDate());
        sprint.setStatus(request.status() == null ? sprint.getStatus() : request.status());
        sprint.setNotes(normalizeText(request.notes()));
    }

    private void applyTask(SmaartTask task, TaskRequest request) {
        task.setTitle(normalizeTitle(request.title()));
        task.setDescription(normalizeText(request.description()));
        task.setPriority(clamp(request.priority(), task.getPriority(), 1, 5));
        task.setCategory(normalizeText(request.category()));
        task.setDueDate(request.dueDate());
        task.setEstimatedMinutes(request.estimatedMinutes());
        task.setUrgency(clamp(request.urgency(), task.getUrgency(), 1, 5));
        task.setImportance(clamp(request.importance(), task.getImportance(), 1, 5));
        task.setImpact(clamp(request.impact(), task.getImpact(), 1, 5));
        task.setEffort(clamp(request.effort(), task.getEffort(), 1, 5));
        task.setTags(normalizeText(request.tags()));
        task.setNotes(normalizeText(request.notes()));
        SmaartStatus status = request.status() == null ? task.getStatus() : request.status();
        if (Boolean.TRUE.equals(request.completed())) {
            status = SmaartStatus.COMPLETED;
        }
        setTaskStatus(task, status);
    }

    private void setTaskStatus(SmaartTask task, SmaartStatus status) {
        task.setStatus(status);
        task.setCompleted(status == SmaartStatus.COMPLETED);
    }

    private void replaceChecklist(SmaartTask task, List<String> items) {
        checklistRepository.deleteAllByTaskIdAndUserId(task.getId(), currentUserService.requireCurrentUserId());
        if (items == null || items.isEmpty()) {
            return;
        }
        AppUser user = currentUserService.requireCurrentUser();
        int index = 0;
        for (String item : items) {
            String title = normalizeText(item);
            if (title != null) {
                checklistRepository.save(new SmaartTaskChecklistItem(user, task, title, index++));
            }
        }
    }

    private void replaceDependencies(SmaartTask task, List<Long> dependencyIds) {
        dependencyRepository.deleteAllByTaskIdAndUserId(task.getId(), currentUserService.requireCurrentUserId());
        if (dependencyIds == null || dependencyIds.isEmpty()) {
            return;
        }
        AppUser user = currentUserService.requireCurrentUser();
        Set<Long> seen = new HashSet<>();
        for (Long dependencyId : dependencyIds) {
            if (dependencyId == null || dependencyId.equals(task.getId()) || !seen.add(dependencyId)) {
                continue;
            }
            SmaartTask dependency = requireOwnedTask(dependencyId);
            if (!dependency.getGoal().getId().equals(task.getGoal().getId())) {
                throw new AccessDeniedException("Task dependency must belong to the same goal");
            }
            dependencyRepository.save(new SmaartTaskDependency(user, task, dependency));
        }
    }

    private Snapshot snapshot(List<SmaartGoal> goals) {
        Long userId = currentUserService.requireCurrentUserId();
        List<Long> goalIds = goals.stream().map(SmaartGoal::getId).toList();
        if (goalIds.isEmpty()) {
            return new Snapshot(List.of(), List.of(), List.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of());
        }
        return snapshot(
                goals,
                sprintRepository.findAllByUserIdAndGoalIdInOrderByStartDateAsc(userId, goalIds),
                taskRepository.findAllByUserIdAndGoalIdInOrderByDueDateAscUpdatedAtDesc(userId, goalIds)
        );
    }

    private Snapshot snapshot(List<SmaartGoal> goals, List<SmaartSprint> sprints, List<SmaartTask> tasks) {
        Long userId = currentUserService.requireCurrentUserId();
        List<Long> taskIds = tasks.stream().map(SmaartTask::getId).filter(Objects::nonNull).toList();
        Map<Long, List<SmaartTaskChecklistItem>> checklist = taskIds.isEmpty()
                ? Map.of()
                : checklistRepository.findAllByUserIdAndTaskIdInOrderBySortOrderAsc(userId, taskIds).stream()
                .collect(Collectors.groupingBy(item -> item.getTask().getId()));
        Map<Long, List<SmaartTaskDependency>> dependencies = taskIds.isEmpty()
                ? Map.of()
                : dependencyRepository.findAllByUserIdAndTaskIdIn(userId, taskIds).stream()
                .collect(Collectors.groupingBy(dependency -> dependency.getTask().getId()));
        return new Snapshot(
                goals,
                sprints,
                tasks,
                sprints.stream().collect(Collectors.groupingBy(sprint -> sprint.getGoal().getId())),
                tasks.stream().collect(Collectors.groupingBy(task -> task.getGoal().getId())),
                tasks.stream().filter(task -> task.getSprint() != null).collect(Collectors.groupingBy(task -> task.getSprint().getId())),
                checklist,
                dependencies
        );
    }

    private List<GoalResponse> goalResponses(List<SmaartGoal> goals, Snapshot snapshot) {
        return goals.stream().map(goal -> goalResponse(goal, snapshot)).toList();
    }

    private GoalResponse goalResponse(SmaartGoal goal, Snapshot snapshot) {
        List<SmaartTask> tasks = snapshot.tasksByGoal().getOrDefault(goal.getId(), List.of()).stream().filter(task -> task.getStatus() != SmaartStatus.ARCHIVED).toList();
        List<SmaartSprint> sprints = snapshot.sprintsByGoal().getOrDefault(goal.getId(), List.of()).stream().filter(sprint -> sprint.getStatus() != SmaartStatus.ARCHIVED).toList();
        int completed = (int) tasks.stream().filter(this::isTaskComplete).count();
        int progress = tasks.isEmpty() ? 0 : (int) Math.round(completed * 100.0 / tasks.size());
        return new GoalResponse(
                goal.getId(),
                goal.getTitle(),
                goal.getDescription(),
                goal.getGoalType(),
                goal.getCategory(),
                goal.getPriority(),
                goal.getStartDate(),
                goal.getDeadline(),
                goal.getStatus(),
                goal.getMotivation(),
                goal.getSuccessCriteria(),
                goal.getNotes(),
                goal.getSpecific(),
                goal.getMeasurable(),
                goal.getAchievable(),
                goal.getActionOriented(),
                goal.getRelevant(),
                goal.getTimeBound(),
                progress,
                urgency(goal, progress),
                progress == 100 && !tasks.isEmpty() && goal.getStatus() != SmaartStatus.COMPLETED,
                tasks.size(),
                completed,
                sprints.size(),
                goal.getCreatedAt(),
                goal.getUpdatedAt()
        );
    }

    private List<SprintResponse> sprintResponses(List<SmaartSprint> sprints, Snapshot snapshot) {
        return sprints.stream().map(sprint -> sprintResponse(sprint, snapshot)).toList();
    }

    private SprintResponse sprintResponse(SmaartSprint sprint, Snapshot snapshot) {
        List<SmaartTask> tasks = snapshot.tasksBySprint().getOrDefault(sprint.getId(), List.of()).stream().filter(task -> task.getStatus() != SmaartStatus.ARCHIVED).toList();
        int completed = (int) tasks.stream().filter(this::isTaskComplete).count();
        int progress = tasks.isEmpty() ? 0 : (int) Math.round(completed * 100.0 / tasks.size());
        return new SprintResponse(
                sprint.getId(),
                sprint.getGoal().getId(),
                sprint.getGoal().getTitle(),
                sprint.getTitle(),
                sprint.getObjective(),
                sprint.getStartDate(),
                sprint.getEndDate(),
                sprint.getStatus(),
                sprint.getNotes(),
                progress,
                tasks.size(),
                completed,
                sprint.getCreatedAt(),
                sprint.getUpdatedAt()
        );
    }

    private List<TaskResponse> taskResponses(List<SmaartTask> tasks, Snapshot snapshot, PriorityWeights weights) {
        return tasks.stream().map(task -> taskResponse(task, snapshot, weights)).toList();
    }

    private TaskResponse taskResponse(SmaartTask task, Snapshot snapshot, PriorityWeights weights) {
        List<ChecklistItemResponse> checklist = snapshot.checklistByTask().getOrDefault(task.getId(), List.of()).stream()
                .map(item -> new ChecklistItemResponse(item.getId(), item.getTitle(), item.isCompleted()))
                .toList();
        List<Long> dependencies = snapshot.dependenciesByTask().getOrDefault(task.getId(), List.of()).stream()
                .map(dependency -> dependency.getDependsOnTask().getId())
                .toList();
        int urgency = factor(task.getUrgency());
        int importance = factor(task.getImportance());
        int impact = factor(task.getImpact());
        int effort = factor(task.getEffort());
        int deadlinePressure = deadlinePressure(task.getDueDate());
        int priorityScore = priorityScore(urgency, importance, impact, effort, deadlinePressure, weights);
        return new TaskResponse(
                task.getId(),
                task.getGoal().getId(),
                task.getGoal().getTitle(),
                task.getSprint() == null ? null : task.getSprint().getId(),
                task.getSprint() == null ? null : task.getSprint().getTitle(),
                task.getTitle(),
                task.getDescription(),
                task.getStatus(),
                task.getPriority(),
                task.getCategory(),
                task.getDueDate(),
                task.getEstimatedMinutes(),
                urgency,
                importance,
                impact,
                effort,
                deadlinePressure,
                priorityScore,
                priorityLevel(priorityScore),
                task.isCompleted(),
                task.getTags(),
                task.getNotes(),
                dependencies,
                checklist,
                task.getCreatedAt(),
                task.getUpdatedAt()
        );
    }

    private ActivityResponse activityResponse(SmaartActivityLog activity) {
        return new ActivityResponse(
                activity.getId(),
                activity.getGoal() == null ? null : activity.getGoal().getId(),
                activity.getSprint() == null ? null : activity.getSprint().getId(),
                activity.getTask() == null ? null : activity.getTask().getId(),
                activity.getAction(),
                activity.getDescription(),
                activity.getCreatedAt()
        );
    }

    private PriorityWeights resolvePriorityWeights() {
        return resolvePriorityWeights(currentUserService.requireCurrentUserId());
    }

    private PriorityWeights resolvePriorityWeights(Long userId) {
        return priorityProfileRepository.findByUserId(userId)
                .map(this::toPriorityWeights)
                .orElse(DEFAULT_PRIORITY_WEIGHTS);
    }

    private PriorityWeights toPriorityWeights(SmaartPriorityProfile profile) {
        return new PriorityWeights(
                clampWeight(profile.getUrgencyWeight(), DEFAULT_PRIORITY_WEIGHTS.urgencyWeight()),
                clampWeight(profile.getImportanceWeight(), DEFAULT_PRIORITY_WEIGHTS.importanceWeight()),
                clampWeight(profile.getDeadlineWeight(), DEFAULT_PRIORITY_WEIGHTS.deadlineWeight()),
                clampWeight(profile.getEffortWeight(), DEFAULT_PRIORITY_WEIGHTS.effortWeight()),
                clampWeight(profile.getImpactWeight(), DEFAULT_PRIORITY_WEIGHTS.impactWeight()),
                clampHighPriorityThreshold(profile.getHighPriorityThreshold(), DEFAULT_PRIORITY_WEIGHTS.highPriorityThreshold())
        );
    }

    private PriorityProfileResponse priorityProfileResponse(PriorityWeights weights) {
        return new PriorityProfileResponse(
                weights.urgencyWeight(),
                weights.importanceWeight(),
                weights.deadlineWeight(),
                weights.effortWeight(),
                weights.impactWeight(),
                weights.highPriorityThreshold()
        );
    }

    private List<PrioritySummaryResponse> distribution(List<TaskResponse> tasks,
                                                       Function<TaskResponse, String> classifier,
                                                       List<String> orderedKeys) {
        Map<String, Long> counts = tasks.stream()
                .collect(Collectors.groupingBy(classifier, Collectors.counting()));
        List<String> keys = orderedKeys == null || orderedKeys.isEmpty()
                ? counts.keySet().stream().sorted(String.CASE_INSENSITIVE_ORDER).toList()
                : orderedKeys;
        return keys.stream()
                .map(key -> new PrioritySummaryResponse(key, counts.getOrDefault(key, 0L)))
                .toList();
    }

    private List<PriorityTrendPointResponse> priorityTrend(List<TaskResponse> tasks, LocalDate start, int highPriorityThreshold) {
        List<PriorityTrendPointResponse> points = new ArrayList<>();
        for (int offset = 0; offset < 14; offset++) {
            LocalDate date = start.plusDays(offset);
            List<TaskResponse> tasksForDate = tasks.stream()
                    .filter(task -> date.equals(task.dueDate()))
                    .toList();
            int totalScore = tasksForDate.stream().mapToInt(TaskResponse::priorityScore).sum();
            long highPriorityCount = tasksForDate.stream()
                    .filter(task -> task.priorityScore() >= highPriorityThreshold)
                    .count();
            points.add(new PriorityTrendPointResponse(shortDateLabel(date), date, totalScore, tasksForDate.size(), highPriorityCount));
        }
        return points;
    }

    private static String shortDateLabel(LocalDate date) {
        return date.getMonthValue() + "/" + date.getDayOfMonth();
    }

    private static int factor(Integer value) {
        return clamp(value, 3, 1, 5);
    }

    private static int deadlinePressure(LocalDate dueDate) {
        if (dueDate == null) {
            return 1;
        }
        long days = dueDate.toEpochDay() - today().toEpochDay();
        if (days <= 1) {
            return 5;
        }
        if (days <= 3) {
            return 4;
        }
        if (days <= 7) {
            return 3;
        }
        if (days <= 14) {
            return 2;
        }
        return 1;
    }

    private static int priorityScore(int urgency, int importance, int impact, int effort, int deadlinePressure, PriorityWeights weights) {
        int effectiveEffort = 6 - effort;
        int weightedSum = (urgency * weights.urgencyWeight())
                + (importance * weights.importanceWeight())
                + (deadlinePressure * weights.deadlineWeight())
                + (effectiveEffort * weights.effortWeight())
                + (impact * weights.impactWeight());
        int denominator = Math.max(1, weights.totalWeight() * 5);
        return (int) Math.round(weightedSum * 100.0 / denominator);
    }

    private static String priorityLevel(int priorityScore) {
        if (priorityScore >= 85) {
            return "CRITICAL";
        }
        if (priorityScore >= 75) {
            return "HIGH";
        }
        if (priorityScore >= 50) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private static String categoryLabel(String category) {
        return normalizeText(category) == null ? "Uncategorized" : category.trim();
    }

    private SmaartGoal requireOwnedGoal(Long goalId) {
        return goalRepository.findByIdAndUserId(goalId, currentUserService.requireCurrentUserId())
                .orElseThrow(() -> new IllegalArgumentException("Goal not found"));
    }

    private SmaartSprint requireOwnedSprint(Long goalId, Long sprintId) {
        SmaartSprint sprint = sprintRepository.findByIdAndUserId(sprintId, currentUserService.requireCurrentUserId())
                .orElseThrow(() -> new IllegalArgumentException("Sprint not found"));
        if (!sprint.getGoal().getId().equals(goalId)) {
            throw new AccessDeniedException("Sprint does not belong to the goal");
        }
        return sprint;
    }

    private SmaartTask requireOwnedTask(Long taskId) {
        return taskRepository.findByIdAndUserId(taskId, currentUserService.requireCurrentUserId())
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));
    }

    private SmaartSprint resolveSprint(SmaartGoal goal, Long sprintId) {
        if (sprintId == null) {
            return null;
        }
        SmaartSprint sprint = sprintRepository.findByIdAndUserId(sprintId, currentUserService.requireCurrentUserId())
                .orElseThrow(() -> new IllegalArgumentException("Sprint not found"));
        if (!sprint.getGoal().getId().equals(goal.getId())) {
            throw new AccessDeniedException("Sprint does not belong to the goal");
        }
        return sprint;
    }

    private void log(AppUser user, SmaartGoal goal, SmaartSprint sprint, SmaartTask task, String action, String description) {
        activityRepository.save(new SmaartActivityLog(user, goal, sprint, task, action, description));
    }

    private boolean isTaskComplete(SmaartTask task) {
        return task.isCompleted() || task.getStatus() == SmaartStatus.COMPLETED;
    }

    private static boolean isActive(SmaartStatus status) {
        return status != SmaartStatus.COMPLETED && status != SmaartStatus.ARCHIVED;
    }

    private static boolean matchesSearch(SmaartGoal goal, String search) {
        String normalized = normalizeText(search);
        if (normalized == null) {
            return true;
        }
        String haystack = (goal.getTitle() + " " + goal.getDescription() + " " + goal.getCategory()).toLowerCase(Locale.ROOT);
        return haystack.contains(normalized.toLowerCase(Locale.ROOT));
    }

    private static String urgency(SmaartGoal goal, int progress) {
        if (goal.getStatus() == SmaartStatus.COMPLETED) {
            return "Completed";
        }
        if (goal.getStatus() == SmaartStatus.ARCHIVED) {
            return "Archived";
        }
        LocalDate today = today();
        if (goal.getDeadline() != null && goal.getDeadline().isBefore(today)) {
            return "Overdue";
        }
        if (goal.getDeadline() == null || goal.getStartDate() == null) {
            return "On track";
        }
        long total = Math.max(1, goal.getDeadline().toEpochDay() - goal.getStartDate().toEpochDay());
        long elapsed = Math.max(0, today.toEpochDay() - goal.getStartDate().toEpochDay());
        int expected = (int) Math.round(Math.min(100, elapsed * 100.0 / total));
        if (progress + 20 < expected) {
            return "Behind schedule";
        }
        if (progress + 8 < expected) {
            return "Needs attention";
        }
        return "On track";
    }

    private static boolean overlaps(LocalDate eventStart, LocalDate eventEnd, LocalDate rangeStart, LocalDate rangeEnd) {
        LocalDate start = eventStart == null ? eventEnd : eventStart;
        LocalDate end = eventEnd == null ? eventStart : eventEnd;
        if (start == null || end == null) {
            return false;
        }
        return !end.isBefore(rangeStart) && !start.isAfter(rangeEnd);
    }

    private static int averageProgress(List<GoalResponse> goals) {
        return goals.isEmpty() ? 0 : (int) Math.round(goals.stream().mapToInt(GoalResponse::progressPercentage).average().orElse(0));
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }

    private static LocalDate normalizeDeadline(LocalDate deadline) {
        return deadline == null ? today().plusDays(7) : deadline;
    }

    private static String normalizeTitle(String value) {
        String normalized = normalizeText(value);
        if (normalized == null) {
            throw new IllegalArgumentException("Title is required");
        }
        return normalized;
    }

    private static String normalizeText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static int clamp(Integer value, int fallback, int min, int max) {
        int resolved = value == null ? fallback : value;
        return Math.min(max, Math.max(min, resolved));
    }

    private static int clampWeight(Integer value, int fallback) {
        return clamp(value, fallback, 1, 5);
    }

    private static int clampHighPriorityThreshold(Integer value, int fallback) {
        return clamp(value, fallback, 50, 95);
    }

    private record Snapshot(
            List<SmaartGoal> goals,
            List<SmaartSprint> sprints,
            List<SmaartTask> tasks,
            Map<Long, List<SmaartSprint>> sprintsByGoal,
            Map<Long, List<SmaartTask>> tasksByGoal,
            Map<Long, List<SmaartTask>> tasksBySprint,
            Map<Long, List<SmaartTaskChecklistItem>> checklistByTask,
            Map<Long, List<SmaartTaskDependency>> dependenciesByTask
    ) {
    }

    private record PriorityWeights(
            int urgencyWeight,
            int importanceWeight,
            int deadlineWeight,
            int effortWeight,
            int impactWeight,
            int highPriorityThreshold
    ) {
        private int totalWeight() {
            return urgencyWeight + importanceWeight + deadlineWeight + effortWeight + impactWeight;
        }
    }
}

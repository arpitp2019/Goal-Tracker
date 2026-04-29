package com.flowdash.service;

import com.flowdash.domain.AppUser;
import com.flowdash.domain.AuthProvider;
import com.flowdash.domain.SmaartGoal;
import com.flowdash.domain.SmaartGoalType;
import com.flowdash.domain.SmaartPriorityProfile;
import com.flowdash.domain.SmaartStatus;
import com.flowdash.domain.SmaartTask;
import com.flowdash.dto.SmaartGoalDtos.GoalRequest;
import com.flowdash.repository.SmaartActivityLogRepository;
import com.flowdash.repository.SmaartGoalRepository;
import com.flowdash.repository.SmaartPriorityProfileRepository;
import com.flowdash.repository.SmaartSprintRepository;
import com.flowdash.repository.SmaartTaskChecklistItemRepository;
import com.flowdash.repository.SmaartTaskDependencyRepository;
import com.flowdash.repository.SmaartTaskRepository;
import com.flowdash.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SmaartGoalServiceTest {

    @Mock
    private SmaartGoalRepository goalRepository;

    @Mock
    private SmaartSprintRepository sprintRepository;

    @Mock
    private SmaartPriorityProfileRepository priorityProfileRepository;

    @Mock
    private SmaartTaskRepository taskRepository;

    @Mock
    private SmaartTaskChecklistItemRepository checklistRepository;

    @Mock
    private SmaartTaskDependencyRepository dependencyRepository;

    @Mock
    private SmaartActivityLogRepository activityRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private SmaartGoalService service;

    @Test
    void createGoalStoresSmaartFieldsWithSafeDefaults() {
        AppUser user = user();
        LocalDate deadline = LocalDate.of(2026, 5, 1);
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(goalRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(activityRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.createGoal(new GoalRequest(
                "Publish portfolio",
                "Ship the first public version",
                SmaartGoalType.SHORT_TERM,
                "Career",
                4,
                LocalDate.of(2026, 4, 20),
                deadline,
                SmaartStatus.TODO,
                "Better opportunities",
                "Published page",
                "Keep it lean",
                "Publish one page",
                "Published URL",
                "One week scope",
                "Write, build, deploy",
                "Career growth",
                "Due by May"
        ));

        assertThat(response.title()).isEqualTo("Publish portfolio");
        assertThat(response.goalType()).isEqualTo(SmaartGoalType.SHORT_TERM);
        assertThat(response.deadline()).isEqualTo(deadline);
        assertThat(response.progressPercentage()).isZero();
    }

    @Test
    void completingTaskMovesStatusAndCompletionFlagTogether() {
        AppUser user = user();
        SmaartGoal goal = new SmaartGoal(user, "Learn Java", SmaartGoalType.SHORT_TERM, LocalDate.of(2026, 5, 1));
        SmaartTask task = new SmaartTask(user, goal, null, "Read generics chapter");
        goal.setId(5L);
        task.setId(10L);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(taskRepository.findByIdAndUserId(10L, 1L)).thenReturn(Optional.of(task));
        when(taskRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(priorityProfileRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(activityRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.updateTaskStatus(10L, SmaartStatus.COMPLETED);

        assertThat(response.status()).isEqualTo(SmaartStatus.COMPLETED);
        assertThat(response.completed()).isTrue();
    }

    @Test
    void sprintCreationIsRejectedForShortTermGoal() {
        AppUser user = user();
        SmaartGoal goal = new SmaartGoal(user, "Pay bill", SmaartGoalType.SHORT_TERM, LocalDate.of(2026, 5, 1));

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(goalRepository.findByIdAndUserId(20L, 1L)).thenReturn(Optional.of(goal));

        assertThatThrownBy(() -> service.createSprint(20L, new com.flowdash.dto.SmaartGoalDtos.SprintRequest(
                "Phase 1",
                "Not allowed",
                LocalDate.of(2026, 4, 20),
                LocalDate.of(2026, 4, 27),
                SmaartStatus.TODO,
                null
        ))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void prioritiesDashboardRanksTasksAndUsesStoredWeights() {
        AppUser user = user();
        LocalDate today = LocalDate.now(java.time.ZoneOffset.UTC);
        SmaartGoal goal = new SmaartGoal(user, "Ship dashboard", SmaartGoalType.SHORT_TERM, today.plusDays(5));
        goal.setId(7L);

        SmaartTask urgent = new SmaartTask(user, goal, null, "Fix onboarding");
        urgent.setId(11L);
        urgent.setUrgency(5);
        urgent.setImportance(5);
        urgent.setImpact(4);
        urgent.setEffort(2);
        urgent.setDueDate(today.plusDays(1));

        SmaartTask later = new SmaartTask(user, goal, null, "Refactor helper");
        later.setId(12L);
        later.setUrgency(2);
        later.setImportance(2);
        later.setImpact(2);
        later.setEffort(4);
        later.setDueDate(today.plusDays(12));

        SmaartPriorityProfile profile = new SmaartPriorityProfile(user);
        profile.setUrgencyWeight(5);
        profile.setImportanceWeight(5);
        profile.setDeadlineWeight(4);
        profile.setImpactWeight(3);
        profile.setEffortWeight(2);
        profile.setHighPriorityThreshold(70);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(goalRepository.findAllByUserIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of(goal));
        when(sprintRepository.findAllByUserIdOrderByStartDateAsc(1L)).thenReturn(List.of());
        when(taskRepository.findAllByUserIdOrderByDueDateAscUpdatedAtDesc(1L)).thenReturn(List.of(urgent, later));
        when(priorityProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        var response = service.prioritiesDashboard();

        assertThat(response.stats().totalTasks()).isEqualTo(2);
        assertThat(response.stats().highPriorityTasks()).isEqualTo(1);
        assertThat(response.tasks()).hasSize(2);
        assertThat(response.tasks().getFirst().title()).isEqualTo("Fix onboarding");
        assertThat(response.tasks().getFirst().priorityScore()).isGreaterThan(response.tasks().get(1).priorityScore());
        assertThat(response.profile().highPriorityThreshold()).isEqualTo(70);
    }

    @Test
    void updatePriorityProfileCreatesOrUpdatesUserPreferences() {
        AppUser user = user();
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(priorityProfileRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(priorityProfileRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.updatePriorityProfile(new com.flowdash.dto.SmaartGoalDtos.PriorityProfileRequest(5, 4, 3, 2, 1, 80));

        assertThat(response.urgencyWeight()).isEqualTo(5);
        assertThat(response.importanceWeight()).isEqualTo(4);
        assertThat(response.deadlineWeight()).isEqualTo(3);
        assertThat(response.effortWeight()).isEqualTo(2);
        assertThat(response.impactWeight()).isEqualTo(1);
        assertThat(response.highPriorityThreshold()).isEqualTo(80);
    }

    private static AppUser user() {
        AppUser user = new AppUser("goals@example.com", "Goals User", null, AuthProvider.LOCAL, null);
        user.setId(1L);
        return user;
    }
}

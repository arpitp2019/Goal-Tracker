package com.flowdash.service;

import com.flowdash.domain.AppUser;
import com.flowdash.domain.AuthProvider;
import com.flowdash.domain.HabitCheckin;
import com.flowdash.domain.HabitCheckinStatus;
import com.flowdash.domain.HabitItem;
import com.flowdash.domain.HabitScheduleType;
import com.flowdash.domain.HabitType;
import com.flowdash.dto.HabitCheckinRequest;
import com.flowdash.dto.HabitRequest;
import com.flowdash.repository.HabitCheckinRepository;
import com.flowdash.repository.HabitRepository;
import com.flowdash.security.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HabitServiceTest {

    @Mock
    private HabitRepository habitRepository;

    @Mock
    private HabitCheckinRepository checkinRepository;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private HabitService service;

    @Test
    void overviewCalculatesTodayProgressOverdueAndStreaks() {
        LocalDate today = LocalDate.now(java.time.ZoneOffset.UTC);
        AppUser user = user(1L);
        HabitItem habit = habit(user, 10L, "Walk", HabitType.BUILD, HabitScheduleType.DAILY, "1,2,3,4,5,6,7");
        HabitCheckin yesterday = checkin(user, habit, today.minusDays(1), HabitCheckinStatus.DONE, null);
        HabitCheckin todayDone = checkin(user, habit, today, HabitCheckinStatus.DONE, null);

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(habitRepository.findAllByUserIdOrderByUpdatedAtDesc(1L)).thenReturn(List.of(habit));
        when(checkinRepository.findAllByUserIdAndCheckinDateBetweenOrderByCheckinDateDesc(any(), any(), any())).thenReturn(List.of(yesterday, todayDone));

        var overview = service.overview(today);

        assertThat(overview.today()).hasSize(1);
        assertThat(overview.stats().todayProgress()).isEqualTo(100);
        assertThat(overview.habits().getFirst().currentStreak()).isGreaterThanOrEqualTo(2);
        assertThat(overview.overdue()).isEmpty();
    }

    @Test
    void numericHabitRequiresTheTargetValueForSuccess() {
        AppUser user = user(1L);
        HabitItem habit = habit(user, 11L, "Read pages", HabitType.NUMERIC, HabitScheduleType.DAILY, "1,2,3,4,5,6,7");
        habit.setTargetValue(20d);
        HabitCheckin partial = checkin(user, habit, LocalDate.now(), HabitCheckinStatus.DONE, 12d);
        HabitCheckin done = checkin(user, habit, LocalDate.now(), HabitCheckinStatus.DONE, 25d);

        assertThat(HabitService.isSuccessful(habit, partial)).isFalse();
        assertThat(HabitService.isSuccessful(habit, done)).isTrue();
    }

    @Test
    void quitHabitTreatsDoneAsAvoidedAndMissedAsBroken() {
        AppUser user = user(1L);
        HabitItem habit = habit(user, 12L, "No doomscrolling", HabitType.QUIT, HabitScheduleType.DAILY, "1,2,3,4,5,6,7");

        assertThat(HabitService.isSuccessful(habit, checkin(user, habit, LocalDate.now(), HabitCheckinStatus.DONE, null))).isTrue();
        assertThat(HabitService.isSuccessful(habit, checkin(user, habit, LocalDate.now(), HabitCheckinStatus.MISSED, null))).isFalse();
    }

    @Test
    void checkInUpsertsOneRecordPerHabitDate() {
        AppUser user = user(1L);
        HabitItem habit = habit(user, 13L, "Meditate", HabitType.BUILD, HabitScheduleType.DAILY, "1,2,3,4,5,6,7");
        LocalDate today = LocalDate.now();

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(currentUserService.requireCurrentUser()).thenReturn(user);
        when(habitRepository.findById(13L)).thenReturn(Optional.of(habit));
        when(checkinRepository.findByHabitIdAndUserIdAndCheckinDate(13L, 1L, today)).thenReturn(Optional.empty());
        when(checkinRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.checkIn(13L, new HabitCheckinRequest(today, HabitCheckinStatus.DONE, null, "calm", 4, 3));

        verify(checkinRepository).save(any(HabitCheckin.class));
        assertThat(response.status()).isEqualTo(HabitCheckinStatus.DONE);
        assertThat(response.successful()).isTrue();
    }

    @Test
    void crossUserHabitAccessIsRejected() {
        HabitItem habit = habit(user(2L), 14L, "Private habit", HabitType.BUILD, HabitScheduleType.DAILY, "1,2,3,4,5,6,7");

        when(currentUserService.requireCurrentUserId()).thenReturn(1L);
        when(habitRepository.findById(14L)).thenReturn(Optional.of(habit));

        assertThatThrownBy(() -> service.update(14L, request("Updated")))
                .isInstanceOf(AccessDeniedException.class);
    }

    private static HabitRequest request(String title) {
        return new HabitRequest(title, null, HabitType.BUILD, HabitScheduleType.DAILY, List.of(1, 2, 3, 4, 5, 6, 7), null, null, null, LocalDate.now(), null, List.of(), "#4be1c3", 3, false, false, null, null, null, null, null, null);
    }

    private static HabitItem habit(AppUser user, Long id, String title, HabitType type, HabitScheduleType scheduleType, String days) {
        HabitItem habit = new HabitItem(user, title, null, type, scheduleType, days, null, null, LocalTime.of(8, 0), LocalDate.now().minusDays(10), null, null, "#4be1c3", 3, false, false, null, null, null, null, null, null);
        habit.setId(id);
        return habit;
    }

    private static HabitCheckin checkin(AppUser user, HabitItem habit, LocalDate date, HabitCheckinStatus status, Double value) {
        return new HabitCheckin(user, habit, date, status, value, null, null, null);
    }

    private static AppUser user(Long id) {
        AppUser user = new AppUser("user" + id + "@example.com", "User " + id, null, AuthProvider.LOCAL, null);
        user.setId(id);
        return user;
    }
}

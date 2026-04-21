package com.flowdash.service;

import com.flowdash.domain.AppUser;
import com.flowdash.domain.HabitCheckin;
import com.flowdash.domain.HabitCheckinStatus;
import com.flowdash.domain.HabitItem;
import com.flowdash.domain.HabitScheduleType;
import com.flowdash.domain.HabitType;
import com.flowdash.dto.HabitAnalyticsResponse;
import com.flowdash.dto.HabitCheckinRequest;
import com.flowdash.dto.HabitCheckinResponse;
import com.flowdash.dto.HabitForecastPointResponse;
import com.flowdash.dto.HabitOverviewResponse;
import com.flowdash.dto.HabitRequest;
import com.flowdash.dto.HabitResponse;
import com.flowdash.dto.HabitStatsResponse;
import com.flowdash.repository.HabitCheckinRepository;
import com.flowdash.repository.HabitRepository;
import com.flowdash.security.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@Transactional
public class HabitService {

    private static final String EVERY_DAY = "1,2,3,4,5,6,7";

    private final HabitRepository habitRepository;
    private final HabitCheckinRepository checkinRepository;
    private final CurrentUserService currentUserService;

    public HabitService(HabitRepository habitRepository, HabitCheckinRepository checkinRepository, CurrentUserService currentUserService) {
        this.habitRepository = habitRepository;
        this.checkinRepository = checkinRepository;
        this.currentUserService = currentUserService;
    }

    public HabitOverviewResponse overview(LocalDate date) {
        LocalDate today = normalizeDate(date);
        HabitSnapshot snapshot = snapshot(today.minusDays(60), today.plusDays(14));
        List<HabitResponse> habits = mapHabits(snapshot.habits(), snapshot.checkinsByHabit(), today);
        List<HabitResponse> todayHabits = habits.stream()
                .filter(HabitResponse::dueToday)
                .sorted(HabitService::sortForToday)
                .toList();
        List<HabitResponse> overdue = habits.stream()
                .filter(HabitResponse::overdue)
                .sorted(Comparator.comparing(HabitResponse::priority).reversed())
                .toList();
        List<HabitResponse> reminders = todayHabits.stream()
                .filter(habit -> habit.reminderTime() != null && habit.todayCheckin() == null)
                .sorted(Comparator.comparing(HabitResponse::reminderTime, Comparator.nullsLast(LocalTime::compareTo)))
                .limit(8)
                .toList();

        return new HabitOverviewResponse(
                stats(habits, todayHabits, overdue, snapshot, today),
                analytics(habits, snapshot, today),
                habits,
                todayHabits,
                overdue,
                reminders
        );
    }

    public List<HabitResponse> list() {
        LocalDate today = normalizeDate(null);
        HabitSnapshot snapshot = snapshot(today.minusDays(60), today.plusDays(14));
        return mapHabits(snapshot.habits(), snapshot.checkinsByHabit(), today);
    }

    public HabitResponse create(HabitRequest request) {
        AppUser user = currentUserService.requireCurrentUser();
        HabitItem item = new HabitItem(
                user,
                normalizeTitle(request.title()),
                normalizeText(request.description()),
                request.habitType() == null ? HabitType.BUILD : request.habitType(),
                request.scheduleType() == null ? HabitScheduleType.DAILY : request.scheduleType(),
                joinDays(defaultDays(request.scheduleType(), request.scheduledDays())),
                request.targetValue(),
                normalizeText(request.targetUnit()),
                request.reminderTime(),
                request.startDate() == null ? normalizeDate(null) : request.startDate(),
                request.endDate(),
                joinTags(request.tags()),
                normalizeColor(request.color()),
                clamp(request.priority(), 3, 1, 5),
                Boolean.TRUE.equals(request.paused()),
                Boolean.TRUE.equals(request.archived()),
                normalizeText(request.cue()),
                normalizeText(request.routine()),
                normalizeText(request.reward()),
                normalizeText(request.friction()),
                normalizeText(request.identityStatement()),
                normalizeText(request.notes())
        );
        HabitItem saved = habitRepository.save(item);
        return response(saved, List.of(), normalizeDate(null));
    }

    public HabitResponse update(Long id, HabitRequest request) {
        HabitItem item = requireOwnedHabit(id);
        item.setTitle(normalizeTitle(request.title()));
        item.setDescription(normalizeText(request.description()));
        item.setHabitType(request.habitType() == null ? item.getHabitType() : request.habitType());
        item.setScheduleType(request.scheduleType() == null ? item.getScheduleType() : request.scheduleType());
        item.setScheduledDays(joinDays(defaultDays(item.getScheduleType(), request.scheduledDays())));
        item.setTargetValue(request.targetValue());
        item.setTargetUnit(normalizeText(request.targetUnit()));
        item.setReminderTime(request.reminderTime());
        item.setStartDate(request.startDate() == null ? item.getStartDate() : request.startDate());
        item.setEndDate(request.endDate());
        item.setTags(joinTags(request.tags()));
        item.setColor(normalizeColor(request.color()));
        item.setPriority(clamp(request.priority(), item.getPriority(), 1, 5));
        item.setPaused(Boolean.TRUE.equals(request.paused()));
        item.setArchived(Boolean.TRUE.equals(request.archived()));
        item.setCue(normalizeText(request.cue()));
        item.setRoutine(normalizeText(request.routine()));
        item.setReward(normalizeText(request.reward()));
        item.setFriction(normalizeText(request.friction()));
        item.setIdentityStatement(normalizeText(request.identityStatement()));
        item.setNotes(normalizeText(request.notes()));
        HabitItem saved = habitRepository.save(item);
        LocalDate today = normalizeDate(null);
        return response(saved, checkinsFor(saved.getId(), today.minusDays(60), today.plusDays(14)), today);
    }

    public void delete(Long id) {
        HabitItem item = requireOwnedHabit(id);
        checkinRepository.deleteAllByHabitIdAndUserId(id, currentUserService.requireCurrentUserId());
        habitRepository.delete(item);
    }

    public HabitCheckinResponse checkIn(Long id, HabitCheckinRequest request) {
        HabitItem habit = requireOwnedHabit(id);
        Long userId = currentUserService.requireCurrentUserId();
        LocalDate date = request.checkinDate() == null ? normalizeDate(null) : request.checkinDate();
        HabitCheckin checkin = checkinRepository.findByHabitIdAndUserIdAndCheckinDate(id, userId, date)
                .orElseGet(() -> new HabitCheckin(currentUserService.requireCurrentUser(), habit, date, request.status(), request.value(), null, null, null));
        checkin.setStatus(request.status() == null ? inferStatus(habit, request.value()) : request.status());
        checkin.setValue(request.value());
        checkin.setNote(normalizeText(request.note()));
        checkin.setMood(clampNullable(request.mood(), 1, 5));
        checkin.setEnergy(clampNullable(request.energy(), 1, 5));
        HabitCheckin saved = checkinRepository.save(checkin);
        return toCheckinResponse(saved, habit);
    }

    public void clearCheckIn(Long id, LocalDate date) {
        requireOwnedHabit(id);
        Long userId = currentUserService.requireCurrentUserId();
        LocalDate checkinDate = date == null ? normalizeDate(null) : date;
        checkinRepository.findByHabitIdAndUserIdAndCheckinDate(id, userId, checkinDate)
                .ifPresent(checkinRepository::delete);
    }

    public List<HabitCheckinResponse> checkins(Long id, LocalDate from, LocalDate to) {
        HabitItem habit = requireOwnedHabit(id);
        LocalDate end = to == null ? normalizeDate(null) : to;
        LocalDate start = from == null ? end.minusDays(30) : from;
        return checkinRepository.findAllByHabitIdAndUserIdAndCheckinDateBetweenOrderByCheckinDateDesc(id, currentUserService.requireCurrentUserId(), start, end)
                .stream()
                .map(checkin -> toCheckinResponse(checkin, habit))
                .toList();
    }

    public static boolean isDueOn(HabitItem habit, LocalDate date) {
        if (habit.isArchived() || habit.isPaused()) {
            return false;
        }
        if (habit.getStartDate() != null && date.isBefore(habit.getStartDate())) {
            return false;
        }
        if (habit.getEndDate() != null && date.isAfter(habit.getEndDate())) {
            return false;
        }
        if (habit.getScheduleType() == HabitScheduleType.DAILY) {
            return true;
        }
        return parseDays(habit.getScheduledDays()).contains(date.getDayOfWeek().getValue());
    }

    public static boolean isSuccessful(HabitItem habit, HabitCheckin checkin) {
        if (checkin == null) {
            return false;
        }
        if (checkin.getStatus() == HabitCheckinStatus.SKIPPED || checkin.getStatus() == HabitCheckinStatus.MISSED) {
            return false;
        }
        if (habit.getHabitType() == HabitType.QUIT) {
            return checkin.getStatus() == HabitCheckinStatus.DONE;
        }
        if ((habit.getHabitType() == HabitType.NUMERIC || habit.getHabitType() == HabitType.TIMER) && habit.getTargetValue() != null) {
            return checkin.getValue() != null && checkin.getValue() >= habit.getTargetValue();
        }
        return checkin.getStatus() == HabitCheckinStatus.DONE;
    }

    private HabitSnapshot snapshot(LocalDate from, LocalDate to) {
        Long userId = currentUserService.requireCurrentUserId();
        List<HabitItem> habits = habitRepository.findAllByUserIdOrderByUpdatedAtDesc(userId);
        List<HabitCheckin> checkins = checkinRepository.findAllByUserIdAndCheckinDateBetweenOrderByCheckinDateDesc(userId, from, to);
        return new HabitSnapshot(habits, groupByHabit(checkins), checkins);
    }

    private List<HabitCheckin> checkinsFor(Long habitId, LocalDate from, LocalDate to) {
        return checkinRepository.findAllByHabitIdAndUserIdAndCheckinDateBetweenOrderByCheckinDateDesc(habitId, currentUserService.requireCurrentUserId(), from, to);
    }

    private static List<HabitResponse> mapHabits(List<HabitItem> habits, Map<Long, List<HabitCheckin>> checkinsByHabit, LocalDate today) {
        return habits.stream()
                .map(habit -> response(habit, checkinsByHabit.getOrDefault(habit.getId(), List.of()), today))
                .toList();
    }

    private static HabitResponse response(HabitItem habit, List<HabitCheckin> checkins, LocalDate today) {
        Map<LocalDate, HabitCheckin> byDate = checkins.stream()
                .collect(Collectors.toMap(HabitCheckin::getCheckinDate, checkin -> checkin, (left, right) -> left));
        boolean dueToday = isDueOn(habit, today);
        boolean overdue = isOverdue(habit, byDate, today);
        HabitCheckin todayCheckin = byDate.get(today);
        long successful = checkins.stream().filter(checkin -> isSuccessful(habit, checkin)).count();
        long counted = checkins.stream().filter(checkin -> checkin.getStatus() != HabitCheckinStatus.SKIPPED).count();
        int completionRate = counted == 0 ? 0 : (int) Math.round(successful * 100.0 / counted);
        int currentStreak = currentStreak(habit, byDate, today);
        int bestStreak = bestStreak(habit, byDate, today.minusDays(120), today);
        return new HabitResponse(
                habit.getId(),
                habit.getTitle(),
                habit.getDescription(),
                habit.getHabitType(),
                habit.getScheduleType(),
                parseDays(habit.getScheduledDays()),
                habit.getTargetValue(),
                habit.getTargetUnit(),
                habit.getReminderTime(),
                habit.getStartDate(),
                habit.getEndDate(),
                splitTags(habit.getTags()),
                habit.getColor(),
                habit.getPriority(),
                habit.isPaused(),
                habit.isArchived(),
                habit.getCue(),
                habit.getRoutine(),
                habit.getReward(),
                habit.getFriction(),
                habit.getIdentityStatement(),
                habit.getNotes(),
                dueToday,
                overdue,
                reminderLabel(habit, dueToday, overdue),
                currentStreak,
                bestStreak,
                completionRate,
                checkins.size(),
                successful,
                todayCheckin == null ? null : toCheckinResponse(todayCheckin, habit),
                habit.getCreatedAt(),
                habit.getUpdatedAt()
        );
    }

    private static HabitCheckinResponse toCheckinResponse(HabitCheckin checkin, HabitItem habit) {
        return new HabitCheckinResponse(
                checkin.getId(),
                checkin.getHabit().getId(),
                checkin.getCheckinDate(),
                checkin.getStatus(),
                checkin.getValue(),
                checkin.getNote(),
                checkin.getMood(),
                checkin.getEnergy(),
                isSuccessful(habit, checkin),
                checkin.getCreatedAt(),
                checkin.getUpdatedAt()
        );
    }

    private static HabitStatsResponse stats(List<HabitResponse> habits, List<HabitResponse> todayHabits, List<HabitResponse> overdue, HabitSnapshot snapshot, LocalDate today) {
        long active = habits.stream().filter(habit -> !habit.archived() && !habit.paused()).count();
        long completedToday = todayHabits.stream().filter(habit -> habit.todayCheckin() != null && habit.todayCheckin().successful()).count();
        int todayProgress = todayHabits.isEmpty() ? 100 : (int) Math.round(completedToday * 100.0 / todayHabits.size());
        int weekly = consistency(snapshot.habits(), snapshot.checkinsByHabit(), today.minusDays(6), today);
        int monthly = consistency(snapshot.habits(), snapshot.checkinsByHabit(), today.minusDays(29), today);
        int activeStreaks = (int) habits.stream().filter(habit -> habit.currentStreak() > 0).count();
        int bestStreak = habits.stream().mapToInt(HabitResponse::bestStreak).max().orElse(0);
        return new HabitStatsResponse(habits.size(), active, todayHabits.size(), completedToday, overdue.size(), todayProgress, weekly, monthly, activeStreaks, bestStreak);
    }

    private static HabitAnalyticsResponse analytics(List<HabitResponse> habits, HabitSnapshot snapshot, LocalDate today) {
        List<HabitResponse> weak = habits.stream()
                .filter(habit -> !habit.archived() && !habit.paused())
                .filter(habit -> habit.completionRate() < 60 || habit.overdue())
                .sorted(Comparator.comparing(HabitResponse::completionRate).thenComparing(HabitResponse::priority).reversed())
                .limit(5)
                .toList();
        List<HabitResponse> best = habits.stream()
                .filter(habit -> habit.bestStreak() > 0)
                .sorted(Comparator.comparing(HabitResponse::bestStreak).reversed())
                .limit(5)
                .toList();
        List<HabitForecastPointResponse> weeklyLoad = IntStream.rangeClosed(0, 6)
                .mapToObj(offset -> forecastPoint(snapshot, today.plusDays(offset)))
                .toList();
        List<HabitForecastPointResponse> monthlyTrend = IntStream.rangeClosed(0, 29)
                .mapToObj(offset -> forecastPoint(snapshot, today.minusDays(29 - offset)))
                .toList();
        return new HabitAnalyticsResponse(weak, best, weeklyLoad, monthlyTrend);
    }

    private static HabitForecastPointResponse forecastPoint(HabitSnapshot snapshot, LocalDate date) {
        long due = snapshot.habits().stream().filter(habit -> isDueOn(habit, date)).count();
        long completed = snapshot.habits().stream()
                .filter(habit -> {
                    HabitCheckin checkin = snapshot.checkinsByHabit().getOrDefault(habit.getId(), List.of()).stream()
                            .filter(candidate -> date.equals(candidate.getCheckinDate()))
                            .findFirst()
                            .orElse(null);
                    return isSuccessful(habit, checkin);
                })
                .count();
        return new HabitForecastPointResponse(date, due, completed);
    }

    private static int consistency(List<HabitItem> habits, Map<Long, List<HabitCheckin>> checkinsByHabit, LocalDate from, LocalDate to) {
        int due = 0;
        int complete = 0;
        LocalDate cursor = from;
        while (!cursor.isAfter(to)) {
            for (HabitItem habit : habits) {
                if (!isDueOn(habit, cursor)) {
                    continue;
                }
                due++;
                LocalDate date = cursor;
                HabitCheckin checkin = checkinsByHabit.getOrDefault(habit.getId(), List.of()).stream()
                        .filter(candidate -> date.equals(candidate.getCheckinDate()))
                        .findFirst()
                        .orElse(null);
                if (isSuccessful(habit, checkin)) {
                    complete++;
                }
            }
            cursor = cursor.plusDays(1);
        }
        return due == 0 ? 100 : (int) Math.round(complete * 100.0 / due);
    }

    private static int currentStreak(HabitItem habit, Map<LocalDate, HabitCheckin> byDate, LocalDate today) {
        int streak = 0;
        LocalDate cursor = today;
        while (!cursor.isBefore(habit.getStartDate() == null ? today.minusDays(120) : habit.getStartDate())) {
            if (!isDueOn(habit, cursor)) {
                cursor = cursor.minusDays(1);
                continue;
            }
            HabitCheckin checkin = byDate.get(cursor);
            if (isSuccessful(habit, checkin)) {
                streak++;
            } else if (checkin != null && checkin.getStatus() == HabitCheckinStatus.SKIPPED) {
                // Intentional skips do not grow or break a streak.
            } else {
                break;
            }
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private static int bestStreak(HabitItem habit, Map<LocalDate, HabitCheckin> byDate, LocalDate from, LocalDate to) {
        int best = 0;
        int current = 0;
        LocalDate cursor = from;
        while (!cursor.isAfter(to)) {
            if (!isDueOn(habit, cursor)) {
                cursor = cursor.plusDays(1);
                continue;
            }
            HabitCheckin checkin = byDate.get(cursor);
            if (isSuccessful(habit, checkin)) {
                current++;
                best = Math.max(best, current);
            } else if (checkin == null || checkin.getStatus() != HabitCheckinStatus.SKIPPED) {
                current = 0;
            }
            cursor = cursor.plusDays(1);
        }
        return best;
    }

    private static boolean isOverdue(HabitItem habit, Map<LocalDate, HabitCheckin> byDate, LocalDate today) {
        LocalDate cursor = today.minusDays(1);
        LocalDate floor = today.minusDays(7);
        while (!cursor.isBefore(floor)) {
            if (isDueOn(habit, cursor)) {
                HabitCheckin checkin = byDate.get(cursor);
                if (checkin == null || checkin.getStatus() == HabitCheckinStatus.MISSED) {
                    return true;
                }
                if (isSuccessful(habit, checkin) || checkin.getStatus() == HabitCheckinStatus.SKIPPED) {
                    return false;
                }
            }
            cursor = cursor.minusDays(1);
        }
        return false;
    }

    private HabitItem requireOwnedHabit(Long id) {
        HabitItem item = habitRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Habit not found"));
        if (!item.getUser().getId().equals(currentUserService.requireCurrentUserId())) {
            throw new AccessDeniedException("Habit does not belong to the current user");
        }
        return item;
    }

    private static Map<Long, List<HabitCheckin>> groupByHabit(List<HabitCheckin> checkins) {
        Map<Long, List<HabitCheckin>> grouped = new HashMap<>();
        for (HabitCheckin checkin : checkins) {
            grouped.computeIfAbsent(checkin.getHabit().getId(), ignored -> new ArrayList<>()).add(checkin);
        }
        return grouped;
    }

    private static List<Integer> defaultDays(HabitScheduleType scheduleType, List<Integer> requested) {
        if (scheduleType == HabitScheduleType.DAILY) {
            return List.of(1, 2, 3, 4, 5, 6, 7);
        }
        List<Integer> clean = requested == null ? List.of() : requested.stream()
                .filter(Objects::nonNull)
                .filter(day -> day >= 1 && day <= 7)
                .distinct()
                .sorted()
                .toList();
        return clean.isEmpty() ? List.of(LocalDate.now(ZoneOffset.UTC).getDayOfWeek().getValue()) : clean;
    }

    private static List<Integer> parseDays(String days) {
        if (days == null || days.isBlank()) {
            return List.of(1, 2, 3, 4, 5, 6, 7);
        }
        return Arrays.stream(days.split(","))
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(Integer::parseInt)
                .filter(day -> day >= 1 && day <= 7)
                .distinct()
                .sorted()
                .toList();
    }

    private static String joinDays(List<Integer> days) {
        return days.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private static List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .toList();
    }

    private static String joinTags(List<String> tags) {
        if (tags == null) {
            return null;
        }
        String joined = tags.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .distinct()
                .collect(Collectors.joining(", "));
        return joined.isBlank() ? null : joined;
    }

    private static HabitCheckinStatus inferStatus(HabitItem habit, Double value) {
        if ((habit.getHabitType() == HabitType.NUMERIC || habit.getHabitType() == HabitType.TIMER) && habit.getTargetValue() != null) {
            return value != null && value >= habit.getTargetValue() ? HabitCheckinStatus.DONE : HabitCheckinStatus.PARTIAL;
        }
        return HabitCheckinStatus.DONE;
    }

    private static String reminderLabel(HabitItem habit, boolean dueToday, boolean overdue) {
        if (overdue) {
            return "Overdue";
        }
        if (!dueToday) {
            return "Upcoming";
        }
        return habit.getReminderTime() == null ? "Due today" : "Due at " + habit.getReminderTime();
    }

    private static int sortForToday(HabitResponse left, HabitResponse right) {
        int reminder = Comparator.comparing(HabitResponse::reminderTime, Comparator.nullsLast(LocalTime::compareTo)).compare(left, right);
        return reminder != 0 ? reminder : Integer.compare(right.priority(), left.priority());
    }

    private static LocalDate normalizeDate(LocalDate date) {
        return date == null ? LocalDate.now(ZoneOffset.UTC) : date;
    }

    private static String normalizeTitle(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }
        return value.trim();
    }

    private static String normalizeText(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String normalizeColor(String value) {
        return value == null || value.isBlank() ? "#4be1c3" : value.trim();
    }

    private static int clamp(Integer value, int fallback, int min, int max) {
        int candidate = value == null ? fallback : value;
        return Math.max(min, Math.min(max, candidate));
    }

    private static Integer clampNullable(Integer value, int min, int max) {
        return value == null ? null : Math.max(min, Math.min(max, value));
    }

    public record HabitSnapshot(List<HabitItem> habits, Map<Long, List<HabitCheckin>> checkinsByHabit, List<HabitCheckin> checkins) {
    }
}

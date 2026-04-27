package com.flowdash.service;

import com.flowdash.domain.AppUser;
import com.flowdash.domain.DecisionMessage;
import com.flowdash.domain.DecisionThread;
import com.flowdash.domain.GoalItem;
import com.flowdash.domain.MindVaultItemSource;
import com.flowdash.domain.MindVaultItemStatus;
import com.flowdash.domain.MindVaultLearningItem;
import com.flowdash.domain.MindVaultLearningType;
import com.flowdash.domain.MindVaultReviewLog;
import com.flowdash.domain.MindVaultResource;
import com.flowdash.domain.MindVaultSprint;
import com.flowdash.domain.MindVaultSprintStatus;
import com.flowdash.domain.MindVaultSubject;
import com.flowdash.domain.VaultEntry;
import com.flowdash.dto.DecisionMessageResponse;
import com.flowdash.dto.DecisionThreadResponse;
import com.flowdash.dto.GoalResponse;
import com.flowdash.dto.MindVaultAnalyticsResponse;
import com.flowdash.dto.MindVaultForecastPointResponse;
import com.flowdash.dto.MindVaultItemResponse;
import com.flowdash.dto.MindVaultOverviewResponse;
import com.flowdash.dto.MindVaultReviewLogResponse;
import com.flowdash.dto.MindVaultResourceResponse;
import com.flowdash.dto.MindVaultSprintResponse;
import com.flowdash.dto.MindVaultStatsResponse;
import com.flowdash.dto.MindVaultSubjectAnalyticsResponse;
import com.flowdash.dto.MindVaultSubjectResponse;
import com.flowdash.dto.UserResponse;
import com.flowdash.dto.VaultResponse;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

public final class ApiMappers {

    private ApiMappers() {
    }

    public static UserResponse toUserResponse(AppUser user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getOauthProvider().name());
    }

    public static GoalResponse toGoalResponse(GoalItem item) {
        return new GoalResponse(item.getId(), item.getTitle(), item.getDescription(), item.getStatus(), item.getPriority(), item.getDueDate(), item.getCreatedAt(), item.getUpdatedAt());
    }

    public static VaultResponse toVaultResponse(VaultEntry item) {
        return new VaultResponse(item.getId(), item.getTitle(), item.getContent(), item.getEntryType(), item.getTags(), item.isFavorite(), item.getCreatedAt(), item.getUpdatedAt());
    }

    public static DecisionThreadResponse toDecisionThreadResponse(DecisionThread thread) {
        return new DecisionThreadResponse(
                thread.getId(),
                thread.getTitle(),
                thread.getSummary(),
                thread.getProviderKey(),
                thread.getProviderModel(),
                thread.getStatus(),
                thread.getMemoGeneratedAt(),
                thread.getLastActiveAt(),
                thread.getCreatedAt(),
                thread.getUpdatedAt()
        );
    }

    public static DecisionMessageResponse toDecisionMessageResponse(DecisionMessage message) {
        return new DecisionMessageResponse(
                message.getId(),
                message.getThread() == null ? null : message.getThread().getId(),
                message.getRole(),
                message.getTabKey(),
                message.getContent(),
                message.getModel(),
                message.getCreatedAt()
        );
    }

    public static MindVaultSubjectResponse toMindVaultSubjectResponse(MindVaultSubject subject, List<MindVaultLearningItem> allItems, List<MindVaultLearningItem> queue) {
        List<MindVaultLearningItem> subjectItems = allItems.stream()
                .filter(item -> item.getSubject() != null && Objects.equals(item.getSubject().getId(), subject.getId()))
                .toList();
        long masteredCount = subjectItems.stream().filter(item -> item.getStatus() == MindVaultItemStatus.MASTERED).count();
        long dueCount = queue.stream()
                .filter(item -> item.getSubject() != null && Objects.equals(item.getSubject().getId(), subject.getId()))
                .count();
        int averageMastery = averageMastery(subjectItems);
        return new MindVaultSubjectResponse(
                subject.getId(),
                subject.getTitle(),
                subject.getDescription(),
                subject.getPriority(),
                subject.getTargetMastery(),
                subject.getDeadline(),
                splitTags(subject.getTags()),
                subject.isArchived(),
                subjectItems.size(),
                masteredCount,
                dueCount,
                averageMastery,
                subject.getCreatedAt(),
                subject.getUpdatedAt()
        );
    }

    public static MindVaultSprintResponse toMindVaultSprintResponse(MindVaultSprint sprint, List<MindVaultLearningItem> allItems, List<MindVaultLearningItem> queue) {
        List<MindVaultLearningItem> sprintItems = allItems.stream()
                .filter(item -> item.getSprint() != null && Objects.equals(item.getSprint().getId(), sprint.getId()))
                .toList();
        long masteredCount = sprintItems.stream().filter(item -> item.getStatus() == MindVaultItemStatus.MASTERED).count();
        long dueCount = queue.stream()
                .filter(item -> item.getSprint() != null && Objects.equals(item.getSprint().getId(), sprint.getId()))
                .count();
        int progress = sprintItems.isEmpty()
                ? 0
                : (int) Math.round(sprintItems.stream().mapToInt(MindVaultLearningItem::getMasteryScore).average().orElse(0));
        return new MindVaultSprintResponse(
                sprint.getId(),
                sprint.getSubject() == null ? null : sprint.getSubject().getId(),
                sprint.getSubject() == null ? null : sprint.getSubject().getTitle(),
                sprint.getTitle(),
                sprint.getDescription(),
                sprint.getStatus(),
                sprint.getStartDate(),
                sprint.getDueDate(),
                sprint.getEstimatedSessions(),
                sprint.getCompletedSessions(),
                sprint.getSubject() == null ? List.of() : splitTags(sprint.getSubject().getTags()),
                sprintItems.size(),
                masteredCount,
                dueCount,
                progress,
                sprint.getCreatedAt(),
                sprint.getUpdatedAt()
        );
    }

    public static MindVaultItemResponse toMindVaultItemResponse(MindVaultLearningItem item) {
        return toMindVaultItemResponse(item, LocalDate.now(ZoneOffset.UTC));
    }

    public static MindVaultItemResponse toMindVaultItemResponse(MindVaultLearningItem item, LocalDate today) {
        LocalDate effectiveDue = MindVaultService.effectiveDueDate(item, today);
        boolean dueToday = effectiveDue.equals(today);
        boolean overdue = effectiveDue.isBefore(today);
        return new MindVaultItemResponse(
                item.getId(),
                item.getSubject() == null ? null : item.getSubject().getId(),
                item.getSubject() == null ? null : item.getSubject().getTitle(),
                item.getSprint() == null ? null : item.getSprint().getId(),
                item.getSprint() == null ? null : item.getSprint().getTitle(),
                item.getSource(),
                item.getLearningType(),
                item.getStatus(),
                item.getTitle(),
                item.getPrompt(),
                item.getAnswer(),
                item.getNotes(),
                splitTags(item.getTags()),
                item.getPriority(),
                item.getImportance(),
                item.getDifficulty(),
                item.getMasteryScore(),
                item.getReviewStreak(),
                item.getReviewCount(),
                item.getSuccessCount(),
                item.getLapseCount(),
                item.getEaseFactor(),
                item.getReviewIntervalDays(),
                item.getNextReviewDate(),
                item.getDueDate(),
                item.getLastReviewedAt(),
                item.getLastRating(),
                item.isReviewEnabled(),
                item.getSourceLabel(),
                item.getResources().stream()
                        .map(ApiMappers::toMindVaultResourceResponse)
                        .toList(),
                item.getStatus() == MindVaultItemStatus.MASTERED,
                dueToday,
                overdue,
                MindVaultService.queueReason(item, today),
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }

    public static MindVaultResourceResponse toMindVaultResourceResponse(MindVaultResource resource) {
        return new MindVaultResourceResponse(
                resource.getId(),
                resource.getItem().getId(),
                resource.getResourceType(),
                resource.getTitle(),
                resource.getDescription(),
                resource.getUrl(),
                resource.getStoragePath(),
                resource.getMimeType(),
                resource.getSizeBytes(),
                resource.getOriginalFileName(),
                resource.getStoragePath() == null || resource.getStoragePath().isBlank() ? null : "/api/mindvault/resources/%d/content".formatted(resource.getId()),
                resource.getCreatedAt(),
                resource.getUpdatedAt()
        );
    }

    public static MindVaultReviewLogResponse toMindVaultReviewLogResponse(MindVaultReviewLog log) {
        return new MindVaultReviewLogResponse(
                log.getId(),
                log.getItem().getId(),
                log.getItem().getTitle(),
                log.getItem().getSubject() == null ? null : log.getItem().getSubject().getTitle(),
                log.getRating(),
                log.getPreviousIntervalDays(),
                log.getNextIntervalDays(),
                log.getMasteryAfter(),
                log.getEaseFactorAfter(),
                log.getNote(),
                log.getCreatedAt()
        );
    }

    public static MindVaultOverviewResponse toMindVaultOverviewResponse(MindVaultService.MindVaultSnapshot snapshot) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<MindVaultLearningItem> queue = MindVaultService.buildQueue(snapshot.items());
        return new MindVaultOverviewResponse(
                toMindVaultStatsResponse(snapshot, queue),
                toMindVaultAnalyticsResponse(snapshot, queue),
                snapshot.subjects().stream()
                        .map(subject -> toMindVaultSubjectResponse(subject, snapshot.items(), queue))
                        .toList(),
                snapshot.sprints().stream()
                        .map(sprint -> toMindVaultSprintResponse(sprint, snapshot.items(), queue))
                        .toList(),
                snapshot.items().stream()
                        .map(item -> toMindVaultItemResponse(item, today))
                        .toList(),
                queue.stream()
                        .map(item -> toMindVaultItemResponse(item, today))
                        .toList(),
                snapshot.reviews().stream()
                        .limit(10)
                        .map(ApiMappers::toMindVaultReviewLogResponse)
                        .toList()
        );
    }

    public static MindVaultAnalyticsResponse toMindVaultAnalyticsResponse(MindVaultService.MindVaultSnapshot snapshot) {
        return toMindVaultAnalyticsResponse(snapshot, MindVaultService.buildQueue(snapshot.items()));
    }

    public static MindVaultStatsResponse toMindVaultStatsResponse(MindVaultService.MindVaultSnapshot snapshot) {
        return toMindVaultStatsResponse(snapshot, MindVaultService.buildQueue(snapshot.items()));
    }

    private static MindVaultAnalyticsResponse toMindVaultAnalyticsResponse(MindVaultService.MindVaultSnapshot snapshot, List<MindVaultLearningItem> queue) {
        List<MindVaultSubjectAnalyticsResponse> subjects = snapshot.subjects().stream()
                .map(subject -> {
                    List<MindVaultLearningItem> subjectItems = snapshot.items().stream()
                            .filter(item -> item.getSubject() != null && Objects.equals(item.getSubject().getId(), subject.getId()))
                            .toList();
                    long masteredCount = subjectItems.stream().filter(item -> item.getStatus() == MindVaultItemStatus.MASTERED).count();
                    long dueCount = queue.stream().filter(item -> item.getSubject() != null && Objects.equals(item.getSubject().getId(), subject.getId())).count();
                    int averageMastery = averageMastery(subjectItems);
                    return new MindVaultSubjectAnalyticsResponse(
                            subject.getId(),
                            subject.getTitle(),
                            subjectItems.size(),
                            masteredCount,
                            dueCount,
                            averageMastery,
                            subject.getTargetMastery(),
                            subject.getDeadline()
                    );
                })
                .toList();

        List<MindVaultForecastPointResponse> forecast = forecastPoints(snapshot.items());
        return new MindVaultAnalyticsResponse(subjects, forecast);
    }

    private static MindVaultStatsResponse toMindVaultStatsResponse(MindVaultService.MindVaultSnapshot snapshot, List<MindVaultLearningItem> queue) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long totalSubjects = snapshot.subjects().size();
        long activeSubjects = snapshot.subjects().stream().filter(subject -> !subject.isArchived()).count();
        long totalSprints = snapshot.sprints().size();
        long activeSprints = snapshot.sprints().stream().filter(sprint -> sprint.getStatus() != MindVaultSprintStatus.COMPLETED).count();
        long totalItems = snapshot.items().size();
        long importantItems = snapshot.items().stream().filter(item -> item.getLearningType() == MindVaultLearningType.IMPORTANT_TOPIC).count();
        long randomItems = snapshot.items().stream().filter(item -> item.getLearningType() == MindVaultLearningType.RANDOM_LEARNING || item.getSource() == MindVaultItemSource.RANDOM).count();
        long resourceCount = snapshot.items().stream().mapToLong(item -> item.getResources().size()).sum();
        long dueToday = queue.stream().filter(item -> MindVaultService.effectiveDueDate(item, today).equals(today)).count();
        long overdue = queue.stream().filter(item -> MindVaultService.effectiveDueDate(item, today).isBefore(today)).count();
        long mastered = snapshot.items().stream().filter(item -> item.getStatus() == MindVaultItemStatus.MASTERED).count();
        long learnedThisWeek = snapshot.items().stream()
                .filter(item -> item.getCreatedAt() != null && item.getCreatedAt().isAfter(Instant.now().minusSeconds(7L * 24L * 60L * 60L)))
                .count();
        long reviewsThisWeek = snapshot.reviews().stream()
                .filter(review -> review.getCreatedAt() != null && review.getCreatedAt().isAfter(Instant.now().minusSeconds(7L * 24L * 60L * 60L)))
                .count();
        int averageMastery = averageMastery(snapshot.items());
        int studyStreak = studyStreak(snapshot.reviews());
        LocalDate nextDeadline = nextDeadline(snapshot);
        return new MindVaultStatsResponse(
                totalSubjects,
                activeSubjects,
                totalSprints,
                activeSprints,
                totalItems,
                importantItems,
                randomItems,
                resourceCount,
                dueToday,
                overdue,
                mastered,
                learnedThisWeek,
                reviewsThisWeek,
                averageMastery,
                studyStreak,
                nextDeadline,
                snapshot.fileUploadsEnabled()
        );
    }

    private static List<MindVaultForecastPointResponse> forecastPoints(List<MindVaultLearningItem> items) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return IntStream.rangeClosed(0, 13)
                .mapToObj(offset -> {
                    LocalDate date = today.plusDays(offset);
                    long count = items.stream()
                            .filter(item -> {
                                LocalDate effectiveDue = MindVaultService.effectiveDueDate(item, today);
                                return (date.equals(today) ? !effectiveDue.isAfter(today) : effectiveDue.equals(date))
                                        && item.getStatus() != MindVaultItemStatus.MASTERED
                                        && item.getStatus() != MindVaultItemStatus.ARCHIVED;
                            })
                            .count();
                    return new MindVaultForecastPointResponse(date, count);
                })
                .toList();
    }

    private static LocalDate nextDeadline(MindVaultService.MindVaultSnapshot snapshot) {
        Stream<LocalDate> subjectDeadlines = snapshot.subjects().stream()
                .filter(subject -> !subject.isArchived() && subject.getDeadline() != null)
                .map(MindVaultSubject::getDeadline);
        Stream<LocalDate> sprintDeadlines = snapshot.sprints().stream()
                .filter(sprint -> sprint.getStatus() != MindVaultSprintStatus.COMPLETED && sprint.getDueDate() != null)
                .map(MindVaultSprint::getDueDate);
        Stream<LocalDate> itemDeadlines = snapshot.items().stream()
                .filter(item -> item.getStatus() != MindVaultItemStatus.ARCHIVED && item.getDueDate() != null)
                .map(MindVaultLearningItem::getDueDate);
        return Stream.of(subjectDeadlines, sprintDeadlines, itemDeadlines)
                .flatMap(stream -> stream)
                .filter(Objects::nonNull)
                .min(LocalDate::compareTo)
                .orElse(null);
    }

    private static int studyStreak(List<MindVaultReviewLog> reviews) {
        Set<LocalDate> days = reviews.stream()
                .map(review -> review.getCreatedAt() == null ? null : review.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        int streak = 0;
        LocalDate cursor = LocalDate.now(ZoneOffset.UTC);
        while (days.contains(cursor)) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    private static int averageMastery(List<MindVaultLearningItem> items) {
        return items.isEmpty()
                ? 0
                : (int) Math.round(items.stream().mapToInt(MindVaultLearningItem::getMasteryScore).average().orElse(0));
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

    public static String joinTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }
        return tags.stream()
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .distinct()
                .collect(Collectors.joining(", "));
    }
}

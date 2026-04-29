package com.flowdash.repository;

import com.flowdash.domain.SmaartTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SmaartTaskRepository extends JpaRepository<SmaartTask, Long> {

    List<SmaartTask> findAllByUserIdOrderByDueDateAscUpdatedAtDesc(Long userId);

    List<SmaartTask> findAllByUserIdAndGoalIdOrderByDueDateAscUpdatedAtDesc(Long userId, Long goalId);

    List<SmaartTask> findAllByUserIdAndGoalIdInOrderByDueDateAscUpdatedAtDesc(Long userId, Collection<Long> goalIds);

    List<SmaartTask> findAllByUserIdAndSprintIdOrderByDueDateAscUpdatedAtDesc(Long userId, Long sprintId);

    List<SmaartTask> findAllByUserIdAndDueDateBetweenOrderByDueDateAsc(Long userId, LocalDate from, LocalDate to);

    Optional<SmaartTask> findByIdAndUserId(Long id, Long userId);

    void deleteAllByGoalIdAndUserId(Long goalId, Long userId);

    void deleteAllBySprintIdAndUserId(Long sprintId, Long userId);
}

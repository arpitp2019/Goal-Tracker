package com.flowdash.repository;

import com.flowdash.domain.SmaartSprint;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SmaartSprintRepository extends JpaRepository<SmaartSprint, Long> {

    List<SmaartSprint> findAllByUserIdOrderByStartDateAsc(Long userId);

    List<SmaartSprint> findAllByUserIdAndGoalIdOrderByStartDateAsc(Long userId, Long goalId);

    List<SmaartSprint> findAllByUserIdAndGoalIdInOrderByStartDateAsc(Long userId, Collection<Long> goalIds);

    Optional<SmaartSprint> findByIdAndUserId(Long id, Long userId);

    void deleteAllByGoalIdAndUserId(Long goalId, Long userId);
}

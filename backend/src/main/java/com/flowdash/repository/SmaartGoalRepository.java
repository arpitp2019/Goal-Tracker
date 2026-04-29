package com.flowdash.repository;

import com.flowdash.domain.SmaartGoal;
import com.flowdash.domain.SmaartStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SmaartGoalRepository extends JpaRepository<SmaartGoal, Long> {

    List<SmaartGoal> findAllByUserIdOrderByUpdatedAtDesc(Long userId);

    List<SmaartGoal> findAllByUserIdAndStatusOrderByUpdatedAtDesc(Long userId, SmaartStatus status);

    Optional<SmaartGoal> findByIdAndUserId(Long id, Long userId);
}

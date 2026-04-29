package com.flowdash.repository;

import com.flowdash.domain.SmaartActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SmaartActivityLogRepository extends JpaRepository<SmaartActivityLog, Long> {

    List<SmaartActivityLog> findTop20ByUserIdOrderByCreatedAtDesc(Long userId);

    List<SmaartActivityLog> findTop30ByUserIdAndGoalIdOrderByCreatedAtDesc(Long userId, Long goalId);
}

package com.flowdash.repository;

import com.flowdash.domain.SmaartTaskDependency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface SmaartTaskDependencyRepository extends JpaRepository<SmaartTaskDependency, Long> {

    List<SmaartTaskDependency> findAllByUserIdAndTaskIdIn(Long userId, Collection<Long> taskIds);

    void deleteAllByTaskIdAndUserId(Long taskId, Long userId);
}

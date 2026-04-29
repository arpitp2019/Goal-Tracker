package com.flowdash.repository;

import com.flowdash.domain.SmaartTaskChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface SmaartTaskChecklistItemRepository extends JpaRepository<SmaartTaskChecklistItem, Long> {

    List<SmaartTaskChecklistItem> findAllByUserIdAndTaskIdInOrderBySortOrderAsc(Long userId, Collection<Long> taskIds);

    void deleteAllByTaskIdAndUserId(Long taskId, Long userId);
}

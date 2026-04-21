package com.flowdash.repository;

import com.flowdash.domain.HabitItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface HabitRepository extends JpaRepository<HabitItem, Long> {
    List<HabitItem> findAllByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<HabitItem> findByIdAndUserId(Long id, Long userId);
}

package com.flowdash.repository;

import com.flowdash.domain.HabitCheckin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface HabitCheckinRepository extends JpaRepository<HabitCheckin, Long> {

    List<HabitCheckin> findAllByUserIdAndCheckinDateBetweenOrderByCheckinDateDesc(Long userId, LocalDate from, LocalDate to);

    List<HabitCheckin> findAllByHabitIdAndUserIdAndCheckinDateBetweenOrderByCheckinDateDesc(Long habitId, Long userId, LocalDate from, LocalDate to);

    Optional<HabitCheckin> findByHabitIdAndUserIdAndCheckinDate(Long habitId, Long userId, LocalDate checkinDate);

    void deleteAllByHabitIdAndUserId(Long habitId, Long userId);
}

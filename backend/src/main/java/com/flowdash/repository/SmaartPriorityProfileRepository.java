package com.flowdash.repository;

import com.flowdash.domain.SmaartPriorityProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SmaartPriorityProfileRepository extends JpaRepository<SmaartPriorityProfile, Long> {

    Optional<SmaartPriorityProfile> findByUserId(Long userId);
}

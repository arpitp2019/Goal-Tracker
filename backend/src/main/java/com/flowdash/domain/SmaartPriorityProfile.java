package com.flowdash.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "smaart_priority_profile")
public class SmaartPriorityProfile extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "urgency_weight", nullable = false)
    private Integer urgencyWeight = 1;

    @Column(name = "importance_weight", nullable = false)
    private Integer importanceWeight = 1;

    @Column(name = "deadline_weight", nullable = false)
    private Integer deadlineWeight = 1;

    @Column(name = "effort_weight", nullable = false)
    private Integer effortWeight = 1;

    @Column(name = "impact_weight", nullable = false)
    private Integer impactWeight = 1;

    @Column(name = "high_priority_threshold", nullable = false)
    private Integer highPriorityThreshold = 75;

    protected SmaartPriorityProfile() {
    }

    public SmaartPriorityProfile(AppUser user) {
        this.user = user;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AppUser getUser() {
        return user;
    }

    public void setUser(AppUser user) {
        this.user = user;
    }

    public Integer getUrgencyWeight() {
        return urgencyWeight;
    }

    public void setUrgencyWeight(Integer urgencyWeight) {
        this.urgencyWeight = urgencyWeight;
    }

    public Integer getImportanceWeight() {
        return importanceWeight;
    }

    public void setImportanceWeight(Integer importanceWeight) {
        this.importanceWeight = importanceWeight;
    }

    public Integer getDeadlineWeight() {
        return deadlineWeight;
    }

    public void setDeadlineWeight(Integer deadlineWeight) {
        this.deadlineWeight = deadlineWeight;
    }

    public Integer getEffortWeight() {
        return effortWeight;
    }

    public void setEffortWeight(Integer effortWeight) {
        this.effortWeight = effortWeight;
    }

    public Integer getImpactWeight() {
        return impactWeight;
    }

    public void setImpactWeight(Integer impactWeight) {
        this.impactWeight = impactWeight;
    }

    public Integer getHighPriorityThreshold() {
        return highPriorityThreshold;
    }

    public void setHighPriorityThreshold(Integer highPriorityThreshold) {
        this.highPriorityThreshold = highPriorityThreshold;
    }
}

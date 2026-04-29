package com.flowdash.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "smaart_goal")
public class SmaartGoal extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false)
    private SmaartGoalType goalType = SmaartGoalType.SHORT_TERM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SmaartStatus status = SmaartStatus.TODO;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    private String category;

    @Column(nullable = false)
    private Integer priority = 3;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(nullable = false)
    private LocalDate deadline;

    @Column(columnDefinition = "text")
    private String motivation;

    @Column(name = "success_criteria", columnDefinition = "text")
    private String successCriteria;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "specific_text", columnDefinition = "text")
    private String specific;

    @Column(name = "measurable_text", columnDefinition = "text")
    private String measurable;

    @Column(name = "achievable_text", columnDefinition = "text")
    private String achievable;

    @Column(name = "action_oriented_text", columnDefinition = "text")
    private String actionOriented;

    @Column(name = "relevant_text", columnDefinition = "text")
    private String relevant;

    @Column(name = "time_bound_text", columnDefinition = "text")
    private String timeBound;

    @Column(name = "migrated_goal_id")
    private Long migratedGoalId;

    protected SmaartGoal() {
    }

    public SmaartGoal(AppUser user, String title, SmaartGoalType goalType, LocalDate deadline) {
        this.user = user;
        this.title = title;
        this.goalType = goalType == null ? SmaartGoalType.SHORT_TERM : goalType;
        this.deadline = deadline;
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

    public SmaartGoalType getGoalType() {
        return goalType;
    }

    public void setGoalType(SmaartGoalType goalType) {
        this.goalType = goalType;
    }

    public SmaartStatus getStatus() {
        return status;
    }

    public void setStatus(SmaartStatus status) {
        this.status = status;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public String getMotivation() {
        return motivation;
    }

    public void setMotivation(String motivation) {
        this.motivation = motivation;
    }

    public String getSuccessCriteria() {
        return successCriteria;
    }

    public void setSuccessCriteria(String successCriteria) {
        this.successCriteria = successCriteria;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getSpecific() {
        return specific;
    }

    public void setSpecific(String specific) {
        this.specific = specific;
    }

    public String getMeasurable() {
        return measurable;
    }

    public void setMeasurable(String measurable) {
        this.measurable = measurable;
    }

    public String getAchievable() {
        return achievable;
    }

    public void setAchievable(String achievable) {
        this.achievable = achievable;
    }

    public String getActionOriented() {
        return actionOriented;
    }

    public void setActionOriented(String actionOriented) {
        this.actionOriented = actionOriented;
    }

    public String getRelevant() {
        return relevant;
    }

    public void setRelevant(String relevant) {
        this.relevant = relevant;
    }

    public String getTimeBound() {
        return timeBound;
    }

    public void setTimeBound(String timeBound) {
        this.timeBound = timeBound;
    }

    public Long getMigratedGoalId() {
        return migratedGoalId;
    }

    public void setMigratedGoalId(Long migratedGoalId) {
        this.migratedGoalId = migratedGoalId;
    }
}

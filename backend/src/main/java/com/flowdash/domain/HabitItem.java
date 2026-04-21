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
import java.time.LocalTime;

@Entity
@Table(name = "habit_item")
public class HabitItem extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "habit_type", nullable = false)
    private HabitType habitType = HabitType.BUILD;

    @Enumerated(EnumType.STRING)
    @Column(name = "schedule_type", nullable = false)
    private HabitScheduleType scheduleType = HabitScheduleType.DAILY;

    @Column(name = "scheduled_days", nullable = false, length = 60)
    private String scheduledDays = "1,2,3,4,5,6,7";

    @Column(name = "target_value")
    private Double targetValue;

    @Column(name = "target_unit", length = 80)
    private String targetUnit;

    @Column(name = "reminder_time")
    private LocalTime reminderTime;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate = LocalDate.now();

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(length = 1000)
    private String tags;

    @Column(length = 32)
    private String color = "#4be1c3";

    @Column(nullable = false)
    private Integer priority = 3;

    @Column(nullable = false)
    private boolean paused = false;

    @Column(nullable = false)
    private boolean archived = false;

    @Column(columnDefinition = "text")
    private String cue;

    @Column(columnDefinition = "text")
    private String routine;

    @Column(columnDefinition = "text")
    private String reward;

    @Column(columnDefinition = "text")
    private String friction;

    @Column(name = "identity_statement", columnDefinition = "text")
    private String identityStatement;

    @Column(columnDefinition = "text")
    private String notes;

    protected HabitItem() {
    }

    public HabitItem(AppUser user,
                     String title,
                     String description,
                     HabitType habitType,
                     HabitScheduleType scheduleType,
                     String scheduledDays,
                     Double targetValue,
                     String targetUnit,
                     LocalTime reminderTime,
                     LocalDate startDate,
                     LocalDate endDate,
                     String tags,
                     String color,
                     Integer priority,
                     boolean paused,
                     boolean archived,
                     String cue,
                     String routine,
                     String reward,
                     String friction,
                     String identityStatement,
                     String notes) {
        this.user = user;
        this.title = title;
        this.description = description;
        this.habitType = habitType == null ? HabitType.BUILD : habitType;
        this.scheduleType = scheduleType == null ? HabitScheduleType.DAILY : scheduleType;
        this.scheduledDays = scheduledDays == null || scheduledDays.isBlank() ? "1,2,3,4,5,6,7" : scheduledDays;
        this.targetValue = targetValue;
        this.targetUnit = targetUnit;
        this.reminderTime = reminderTime;
        this.startDate = startDate == null ? LocalDate.now() : startDate;
        this.endDate = endDate;
        this.tags = tags;
        this.color = color == null || color.isBlank() ? "#4be1c3" : color;
        this.priority = priority == null ? 3 : priority;
        this.paused = paused;
        this.archived = archived;
        this.cue = cue;
        this.routine = routine;
        this.reward = reward;
        this.friction = friction;
        this.identityStatement = identityStatement;
        this.notes = notes;
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

    public HabitType getHabitType() {
        return habitType;
    }

    public void setHabitType(HabitType habitType) {
        this.habitType = habitType;
    }

    public HabitScheduleType getScheduleType() {
        return scheduleType;
    }

    public void setScheduleType(HabitScheduleType scheduleType) {
        this.scheduleType = scheduleType;
    }

    public String getScheduledDays() {
        return scheduledDays;
    }

    public void setScheduledDays(String scheduledDays) {
        this.scheduledDays = scheduledDays;
    }

    public Double getTargetValue() {
        return targetValue;
    }

    public void setTargetValue(Double targetValue) {
        this.targetValue = targetValue;
    }

    public String getTargetUnit() {
        return targetUnit;
    }

    public void setTargetUnit(String targetUnit) {
        this.targetUnit = targetUnit;
    }

    public LocalTime getReminderTime() {
        return reminderTime;
    }

    public void setReminderTime(LocalTime reminderTime) {
        this.reminderTime = reminderTime;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public boolean isPaused() {
        return paused;
    }

    public void setPaused(boolean paused) {
        this.paused = paused;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public String getCue() {
        return cue;
    }

    public void setCue(String cue) {
        this.cue = cue;
    }

    public String getRoutine() {
        return routine;
    }

    public void setRoutine(String routine) {
        this.routine = routine;
    }

    public String getReward() {
        return reward;
    }

    public void setReward(String reward) {
        this.reward = reward;
    }

    public String getFriction() {
        return friction;
    }

    public void setFriction(String friction) {
        this.friction = friction;
    }

    public String getIdentityStatement() {
        return identityStatement;
    }

    public void setIdentityStatement(String identityStatement) {
        this.identityStatement = identityStatement;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}

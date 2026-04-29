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
@Table(name = "smaart_task")
public class SmaartTask extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "goal_id")
    private SmaartGoal goal;

    @ManyToOne
    @JoinColumn(name = "sprint_id")
    private SmaartSprint sprint;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SmaartStatus status = SmaartStatus.TODO;

    @Column(nullable = false)
    private Integer priority = 3;

    private String category;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "estimated_minutes")
    private Integer estimatedMinutes;

    @Column(nullable = false)
    private Integer urgency = 3;

    @Column(nullable = false)
    private Integer importance = 3;

    @Column(nullable = false)
    private Integer impact = 3;

    @Column(nullable = false)
    private Integer effort = 3;

    @Column(nullable = false)
    private boolean completed = false;

    private String tags;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    protected SmaartTask() {
    }

    public SmaartTask(AppUser user, SmaartGoal goal, SmaartSprint sprint, String title) {
        this.user = user;
        this.goal = goal;
        this.sprint = sprint;
        this.title = title;
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

    public SmaartGoal getGoal() {
        return goal;
    }

    public SmaartSprint getSprint() {
        return sprint;
    }

    public void setSprint(SmaartSprint sprint) {
        this.sprint = sprint;
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

    public SmaartStatus getStatus() {
        return status;
    }

    public void setStatus(SmaartStatus status) {
        this.status = status;
    }

    public Integer getPriority() {
        return priority;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public Integer getEstimatedMinutes() {
        return estimatedMinutes;
    }

    public void setEstimatedMinutes(Integer estimatedMinutes) {
        this.estimatedMinutes = estimatedMinutes;
    }

    public Integer getUrgency() {
        return urgency;
    }

    public void setUrgency(Integer urgency) {
        this.urgency = urgency;
    }

    public Integer getImportance() {
        return importance;
    }

    public void setImportance(Integer importance) {
        this.importance = importance;
    }

    public Integer getImpact() {
        return impact;
    }

    public void setImpact(Integer impact) {
        this.impact = impact;
    }

    public Integer getEffort() {
        return effort;
    }

    public void setEffort(Integer effort) {
        this.effort = effort;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}

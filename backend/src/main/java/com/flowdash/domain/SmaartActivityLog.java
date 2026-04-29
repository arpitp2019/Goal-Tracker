package com.flowdash.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "smaart_activity_log")
public class SmaartActivityLog extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @ManyToOne
    @JoinColumn(name = "goal_id")
    private SmaartGoal goal;

    @ManyToOne
    @JoinColumn(name = "sprint_id")
    private SmaartSprint sprint;

    @ManyToOne
    @JoinColumn(name = "task_id")
    private SmaartTask task;

    @Column(name = "activity_action", nullable = false)
    private String action;

    @Column(columnDefinition = "text")
    private String description;

    protected SmaartActivityLog() {
    }

    public SmaartActivityLog(AppUser user, SmaartGoal goal, SmaartSprint sprint, SmaartTask task, String action, String description) {
        this.user = user;
        this.goal = goal;
        this.sprint = sprint;
        this.task = task;
        this.action = action;
        this.description = description;
    }

    public Long getId() {
        return id;
    }

    public SmaartGoal getGoal() {
        return goal;
    }

    public SmaartSprint getSprint() {
        return sprint;
    }

    public SmaartTask getTask() {
        return task;
    }

    public String getAction() {
        return action;
    }

    public String getDescription() {
        return description;
    }
}

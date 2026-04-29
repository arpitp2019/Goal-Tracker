package com.flowdash.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(
        name = "smaart_task_dependency",
        uniqueConstraints = @UniqueConstraint(name = "uk_smaart_task_dependency_pair", columnNames = {"task_id", "depends_on_task_id"})
)
public class SmaartTaskDependency extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "task_id")
    private SmaartTask task;

    @ManyToOne(optional = false)
    @JoinColumn(name = "depends_on_task_id")
    private SmaartTask dependsOnTask;

    protected SmaartTaskDependency() {
    }

    public SmaartTaskDependency(AppUser user, SmaartTask task, SmaartTask dependsOnTask) {
        this.user = user;
        this.task = task;
        this.dependsOnTask = dependsOnTask;
    }

    public Long getId() {
        return id;
    }

    public SmaartTask getTask() {
        return task;
    }

    public SmaartTask getDependsOnTask() {
        return dependsOnTask;
    }
}

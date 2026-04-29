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
@Table(name = "smaart_task_checklist_item")
public class SmaartTaskChecklistItem extends AuditFields {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "task_id")
    private SmaartTask task;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private boolean completed = false;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    protected SmaartTaskChecklistItem() {
    }

    public SmaartTaskChecklistItem(AppUser user, SmaartTask task, String title, Integer sortOrder) {
        this.user = user;
        this.task = task;
        this.title = title;
        this.sortOrder = sortOrder == null ? 0 : sortOrder;
    }

    public Long getId() {
        return id;
    }

    public AppUser getUser() {
        return user;
    }

    public SmaartTask getTask() {
        return task;
    }

    public String getTitle() {
        return title;
    }

    public boolean isCompleted() {
        return completed;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }
}

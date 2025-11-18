import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, FormEvent, useState } from "react";
import { z, ZodIssue } from "zod";
import { CreateVisitorPayload, createVisitor, Visitor } from "../api";

const visitorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  purpose: z.string().min(3),
});

type VisitorFormValues = z.infer<typeof visitorSchema>;

interface VisitorFormProps {
  onSuccess: (visitor: Visitor) => void;
}

const defaultValues: VisitorFormValues = {
  name: "",
  email: "",
  phone: "",
  purpose: "",
};

export function VisitorForm({ onSuccess }: VisitorFormProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<VisitorFormValues>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (payload: CreateVisitorPayload) => createVisitor(payload),
    onSuccess(visitor: Visitor) {
      onSuccess(visitor);
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      setValues(defaultValues);
      setErrors({});
    },
    onError(error: unknown) {
      console.error("Failed to create visitor", error);
    },
  });

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setValues((prev: VisitorFormValues) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parseResult = visitorSchema.safeParse(values);
    if (!parseResult.success) {
      const formattedErrors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue: ZodIssue) => {
        const key = issue.path[0];
        if (typeof key === "string") {
          formattedErrors[key] = issue.message;
        }
      });
      setErrors(formattedErrors);
      return;
    }

    setErrors({});
    mutation.mutate(parseResult.data);
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Visitor Registration</h2>
      <label>
        Full name
        <input
          name="name"
          value={values.name}
          onChange={handleChange}
          placeholder="Jane Doe"
          required
        />
        {errors.name && <span className="error">{errors.name}</span>}
      </label>
      <label>
        Email
        <input
          type="email"
          name="email"
          value={values.email}
          onChange={handleChange}
          placeholder="jane@example.com"
          required
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </label>
      <label>
        Phone number
        <input
          name="phone"
          value={values.phone}
          onChange={handleChange}
          placeholder="9876543210"
          required
        />
        {errors.phone && <span className="error">{errors.phone}</span>}
      </label>
      <label>
        Purpose of visit
        <textarea
          name="purpose"
          value={values.purpose}
          onChange={handleChange}
          placeholder="Meeting with operations team"
          required
        />
        {errors.purpose && <span className="error">{errors.purpose}</span>}
      </label>
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Submitting..." : "Register Visitor"}
      </button>
    </form>
  );
}

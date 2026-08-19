import * as React from "react";

const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToastProps = {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type ToastActionElement = React.ReactElement;

type State = {
  toasts: ToastProps[];
};

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const;

type Action =
  | {
      type: typeof actionTypes.ADD_TOAST;
      toast: ToastProps;
    }
  | {
      type: typeof actionTypes.UPDATE_TOAST;
      toast: Partial<ToastProps>;
    }
  | {
      type: typeof actionTypes.DISMISS_TOAST;
      toastId?: string;
    }
  | {
      type: typeof actionTypes.REMOVE_TOAST;
      toastId?: string;
    };

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === action.toast.id
            ? { ...toast, ...action.toast }
            : toast
        ),
      };

    case actionTypes.DISMISS_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          action.toastId === undefined || toast.id === action.toastId
            ? { ...toast, open: false }
            : toast
        ),
      };

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }

      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
      };

    default:
      return state;
  }
}

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

type Toast = Omit<ToastProps, "id">;

function toast(props: Toast) {
  const id = genId();

  const update = (props: Partial<ToastProps>) =>
    dispatch({
      type: actionTypes.UPDATE_TOAST,
      toast: { ...props, id },
    });

  const dismiss = () =>
    dispatch({
      type: actionTypes.DISMISS_TOAST,
      toastId: id,
    });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);

    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) =>
      dispatch({
        type: actionTypes.DISMISS_TOAST,
        toastId,
      }),
  };
}

export { useToast, toast };
export type { ToastActionElement, ToastProps };
